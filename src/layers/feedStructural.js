/**
 * Structural feed failures: the endpoint isn't deployed (404/501 on one of
 * our own /api/* routes). Terminal by definition — retrying a route that
 * cannot exist is a lie that also burns requests. Layers call
 * applyStructuralMissing() in their ingestion catch; the feed then reports
 * NOT CONFIGURED instead of UNAVAILABLE-with-a-retry-countdown.
 */

/** True when the error marks a structurally-missing endpoint. */
export function isStructuralMissing(error) {
  return error?.structural === true;
}

/**
 * Apply the terminal state to a feed. Returns true when applied (the caller
 * should skip its normal backoff scheduling).
 */
export function applyStructuralMissing(feed, error) {
  if (!isStructuralMissing(error)) return false;
  feed._notConfigured = true;
  feed._backoff = false;
  feed._retryAt = 0;
  feed._lastStatus = error?.status ?? 404;
  feed._lastError = null;
  return true;
}

/** True when a feed already sits in the terminal not-configured state. */
export function feedNotConfigured(feed) {
  return feed?._notConfigured === true;
}
