/**
 * One-shot probe for voice backend configuration.
 *
 * GET /api/realtime/token?probe=1 returns {configured} without minting a
 * token. Result is cached per page load — the key can't appear mid-session
 * without a redeploy. On probe failure (dev server, offline) we return
 * {configured: null}: unknown, not "missing". Callers must fail open —
 * hiding voice affordances on an inconclusive probe would be worse than
 * showing them.
 */

let cached = null;

export function probeVoiceKey() {
  if (!cached) {
    cached = fetch('/api/realtime/token?probe=1', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
      .then(async (response) => {
        if (!response.ok) return { configured: null };
        const payload = await response.json().catch(() => null);
        return {
          configured:
            typeof payload?.configured === 'boolean'
              ? payload.configured
              : null,
        };
      })
      .catch(() => ({ configured: null }));
  }
  return cached;
}
