/** Start a requestAnimationFrame loop; returns a cancel function. */
export function runAnimationFrameLoop(
  callback: (deltaMs: number, timestamp: number) => void,
): () => void {
  let rafId = 0;
  let lastTimestamp = 0;

  const tick = (timestamp: number) => {
    rafId = requestAnimationFrame(tick);
    const deltaMs = lastTimestamp > 0 ? timestamp - lastTimestamp : 16;
    lastTimestamp = timestamp;
    callback(deltaMs, timestamp);
  };

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

/** Frame-rate-independent exponential smoothing factor. */
export function smoothStep(deltaMs: number, tauMs = 40): number {
  return 1 - Math.exp(-Math.max(0, deltaMs) / tauMs);
}
