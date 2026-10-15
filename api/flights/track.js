/**
 * Vercel serverless stub for /api/flights/track?icao24=<hex6>.
 *
 * The Express version backfills tracks via OpenSky's experimental
 * /tracks/all endpoint, which needs OpenSky credentials that don't exist on
 * this deploy (and anonymous OpenSky is quota-starved from shared serverless
 * IPs). Returning a fabricated single-point "trail" from adsb.lol would be
 * dishonest data, so this endpoint is explicit about the gap: 501 with a
 * machine-readable code the client surfaces as NOT CONFIGURED instead of
 * retry-looping a 404.
 */
import { vercelSameSiteOk } from '../_lib/vercel-same-site.js';

export default function handler(req, res) {
  if (!vercelSameSiteOk(req, res)) return;
  const icao24 = String(req.query?.icao24 || '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(icao24)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'icao24 must be a 6-char hex string' }));
    return;
  }
  res.statusCode = 501;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      error: 'Track backfill is not available on the static deploy',
      code: 'not_configured',
    }),
  );
}
