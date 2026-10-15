/**
 * Same-site gate adapted for Vercel serverless.
 *
 * Thin adapter over the pure, unit-tested admitSameSiteRequest core
 * (src/localRequestGate.mjs) — the policy lives in exactly one place so the
 * security-critical comparison logic can't drift between copies.
 *
 * The one Vercel adaptation: the dev server refuses any request carrying
 * reverse-proxy headers (it assumes "proxied = not this machine"), but on
 * Vercel every request is proxied by the edge network, so that rule would 403
 * the app's own same-origin fetches. We pass no proxyHeaders, keeping the
 * parts that matter against the real threat (a foreign site spending the
 * owner's API quota from a visitor's browser): Sec-Fetch-Site + exact-Origin,
 * failing closed on malformed input.
 */
import { admitSameSiteRequest } from '../../src/localRequestGate.mjs';

export function vercelSameSiteOk(req, res) {
  const headers = req.headers || {};
  const proto = String(headers['x-forwarded-proto'] || 'https')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const verdict = admitSameSiteRequest({
    hostHeader: headers.host,
    protocol: `${proto || 'https'}:`,
    origin: headers.origin,
    secFetchSite: headers['sec-fetch-site'],
    proxyHeaders: {},
  });
  if (verdict.ok) return true;
  res.statusCode = verdict.status || 403;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: verdict.error || 'Request refused' }));
  return false;
}
