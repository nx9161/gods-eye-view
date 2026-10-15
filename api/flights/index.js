/**
 * Vercel serverless port of the standalone dev server's /api/flights endpoint
 * (server/providers/aircraft/opensky.js).
 *
 * Serves GET /api/flights?lat=<deg>&lon=<deg> as an OpenSky-shaped snapshot
 * ({time, states}) so the client's existing openSkySnapshot() normalization
 * works unchanged. Data: adsb.lol (primary) -> adsb.fi (failover), both
 * keyless community ADS-B aggregators; adsb.lol data is ODbL (attribution is
 * registered in src/data/dataCredits.js).
 *
 * Deliberately NOT ported from the Express version:
 *  - OpenSky OAuth/Basic (no OPENSKY_* credentials on this deploy; anonymous
 *    OpenSky is quota-starved from shared serverless IPs, and operational
 *    OpenSky REST use can require prior written agreement per DATA_SOURCES.md).
 *  - enrichment.js (writes .gev-cache/adsbdb.json to disk — ephemeral and
 *    pointless on serverless; adsbdb route data also carries a
 *    no-redistribution restriction).
 *
 * Hobby-window discipline: 8s upstream timeout per source, ~2MB response cap,
 * 60s module-level cache (fresh-serve within TTL, serve-stale-on-error),
 * sequential failover. maxDuration is 20s so a primary stall doesn't kill
 * the failover attempt.
 */
import { normalizeAdsbLolPointResponse } from '../../src/data/adsbLolFallback.js';
import { vercelSameSiteOk } from '../_lib/vercel-same-site.js';

const RADIUS_NM = 250;
const CACHE_MS = 60_000;
const CACHE_MAX = 200;
const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const SOURCES = [
  {
    name: 'adsb.lol',
    url: (lat, lon) =>
      `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${RADIUS_NM}`,
    coverage: `${RADIUS_NM}nm regional`,
  },
  {
    name: 'adsb.fi',
    // Same readsb-style point API shape as adsb.lol (opendata.adsb.fi/api/v3).
    url: (lat, lon) =>
      `https://opendata.adsb.fi/api/v3/lat/${lat}/lon/${lon}/dist/${RADIUS_NM}`,
    coverage: `${RADIUS_NM}nm regional`,
  },
];

/** @type {Map<string, {body: string, cachedAt: number, count: number, source: string}>} */
const cache = new Map();

function anchor(query) {
  const latitude = Number(query?.lat);
  const longitude = Number(query?.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    return null;
  return { latitude, longitude };
}

/** Fetch text with a byte cap so a runaway upstream can't OOM the function. */
async function fetchTextCapped(url, timeoutMs, maxBytes) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'gods-eye-view-flights/1.0',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      reader.cancel();
      throw new Error('upstream response exceeded byte cap');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function fetchSnapshot(lat, lon) {
  let lastError = null;
  for (const source of SOURCES) {
    try {
      const text = await fetchTextCapped(
        source.url(lat, lon),
        UPSTREAM_TIMEOUT_MS,
        MAX_RESPONSE_BYTES,
      );
      const normalized = normalizeAdsbLolPointResponse(JSON.parse(text));
      return { ...source, normalized };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('all flight sources failed');
}

export default async function handler(req, res) {
  if (!vercelSameSiteOk(req, res)) return;
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const parsed = anchor(req.query);
  if (!parsed) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'lat and lon query params required' }));
    return;
  }
  // Quarter-degree grid: nearby pans share cache entries.
  const lat = Math.round(parsed.latitude * 4) / 4;
  const lon = Math.round(parsed.longitude * 4) / 4;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const now = Date.now();
  const cached = cache.get(key);

  // Fresh-serve within TTL: the module cache is real, not just stale-fallback.
  if (cached && now - cached.cachedAt < CACHE_MS) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
    res.setHeader('X-Flight-Source', cached.source);
    res.setHeader('X-Flight-Coverage', `${RADIUS_NM}nm regional`);
    res.setHeader('X-Flight-Count', String(cached.count));
    res.end(cached.body);
    return;
  }

  try {
    const fresh = await fetchSnapshot(lat, lon);
    const record = {
      body: JSON.stringify(fresh.normalized),
      cachedAt: now,
      count: fresh.normalized.states.length,
      source: fresh.name,
    };
    cache.delete(key);
    cache.set(key, record);
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
    res.setHeader('X-Flight-Source', record.source);
    res.setHeader('X-Flight-Coverage', `${RADIUS_NM}nm regional`);
    res.setHeader('X-Flight-Count', String(record.count));
    res.end(record.body);
  } catch (error) {
    if (cached) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
      res.setHeader('X-Flight-Source', cached.source);
      res.setHeader('X-Flight-Coverage', `${RADIUS_NM}nm regional (stale)`);
      res.setHeader('X-Flight-Count', String(cached.count));
      res.end(cached.body);
      return;
    }
    console.warn('[api/flights]', error?.message || error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Flight sources unavailable' }));
  }
}
