/**
 * Vercel serverless port of the standalone dev server's
 * /api/realtime/token endpoint (server/providers/openai.js).
 *
 * Mints a short-lived OpenAI Realtime client secret from the server-side
 * OPENAI_API_KEY. The key never reaches the browser; the client connects
 * to the Realtime API over WebRTC with the ephemeral secret.
 *
 * ChatGPT OAuth mode is intentionally unavailable here: it is loopback-only
 * in the upstream implementation (this machine only).
 */
import { createRealtimeTokenHandler } from '../../server/providers/openai/realtime.js';
import { vercelSameSiteOk } from '../_lib/vercel-same-site.js';

const handler = createRealtimeTokenHandler();

export default function (req, res) {
  if (!vercelSameSiteOk(req, res)) return;
  return handler(req, res);
}
