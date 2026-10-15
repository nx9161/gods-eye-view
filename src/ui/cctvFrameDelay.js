/**
 * Camera handoff choreography (Psylocke N1).
 *
 * When a camera is selected with fly-to focus, the CCTV frame waits until
 * 70% of the flight completes before fading in — timed to the
 * routeRampFraction curve, so the frame arrives as the globe does. The
 * existing #cctv-frame opacity transition provides the cross-fade; this
 * module only carries the timing.
 *
 * Single-shot: consumeCctvFrameDelay() returns the remaining wait once,
 * then clears. Late presentation ticks (after the flight) get 0.
 */

let delayUntil = 0;

export function setCctvFrameDelayUntil(timestampMs) {
  delayUntil = timestampMs;
}

export function consumeCctvFrameDelay() {
  const now = Date.now();
  if (delayUntil > now) {
    const wait = delayUntil - now;
    delayUntil = 0;
    return wait;
  }
  delayUntil = 0;
  return 0;
}
