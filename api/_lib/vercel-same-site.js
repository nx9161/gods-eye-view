/**
 * Same-site gate adapted for Vercel serverless.
 *
 * The standalone dev server refuses any request carrying reverse-proxy
 * headers (it assumes "proxied = not this machine"). On Vercel every
 * request is proxied by the edge network, so that rule would 403 the
 * app's own same-origin fetches. This gate keeps the parts that matter
 * against the real threat (a foreign site spending the owner's OpenAI
 * quota from a visitor's browser):
 *   1. Sec-Fetch-Site, when present, must be same-origin or none.
 *   2. Origin, when present (and not opaque), must exactly equal this
 *      deployment's own origin, derived from Host + x-forwarded-proto.
 */
export function vercelSameSiteOk(req, res) {
  const headers = req.headers || {};
  const deny = (error) => {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error }));
    return false;
  };

  const site = String(headers['sec-fetch-site'] || '').trim().toLowerCase();
  if (site !== '' && site !== 'same-origin' && site !== 'none') {
    return deny('Cross-site requests are not accepted');
  }

  const origin = String(headers.origin || '').trim();
  if (origin === 'null') return deny('Opaque origins are not accepted');
  if (origin) {
    const host = String(headers.host || '').trim().toLowerCase();
    const proto = String(headers['x-forwarded-proto'] || 'https')
      .split(',')[0]
      .trim()
      .toLowerCase();
    let ok = false;
    try {
      const parsed = new URL(origin);
      ok =
        parsed.username === '' &&
        parsed.password === '' &&
        parsed.origin === new URL(`${proto}://${host}`).origin;
    } catch {
      ok = false;
    }
    if (!ok) return deny('Origin refused');
  }
  return true;
}
