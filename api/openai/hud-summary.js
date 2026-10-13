/**
 * Vercel serverless port of the standalone dev server's
 * /api/openai/hud-summary endpoint (server/providers/openai.js).
 *
 * Returns the terse AI HUD readout of the current view. Without
 * OPENAI_API_KEY it answers with the keyless fallback payload
 * (no provider cost), same as the dev server.
 */
import { handleHudSummary } from '../../server/providers/openai/hud-summary.js';
import { vercelSameSiteOk } from '../_lib/vercel-same-site.js';

export default function (req, res) {
  if (!vercelSameSiteOk(req, res)) return;
  return handleHudSummary(req, res);
}
