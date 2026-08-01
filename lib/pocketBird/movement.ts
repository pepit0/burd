/** Movement constants copied from Pocket Bird (`src/application.js`). */

export const POCKET_BIRD_UPDATE_MS = 1000 / 60;
export const POCKET_BIRD_HOP_SPEED = 0.07;
export const POCKET_BIRD_FLY_SPEED = 0.25;
export const POCKET_BIRD_HOP_DISTANCE = 35;
export const POCKET_BIRD_HOP_DELAY_MS = 500;
export const POCKET_BIRD_HOP_CHANCE = 1 / (60 * 2.5);
export const POCKET_BIRD_AFK_MS = 1000 * 5;
export const POCKET_BIRD_FOCUS_SWITCH_CHANCE = 1 / (60 * 20);

export type PocketBirdMovementState = "idle" | "hop" | "flying";

export interface PocketBirdBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function getPocketBirdBounds(
  arenaWidth: number,
  arenaHeight: number,
  birdSize: number,
): PocketBirdBounds {
  const half = birdSize / 2;
  return {
    left: half,
    right: Math.max(half, arenaWidth - half),
    top: half,
    bottom: Math.max(half, arenaHeight - half),
  };
}

export function getScaledHopDistance(birdSize: number): number {
  return birdSize * (POCKET_BIRD_HOP_DISTANCE / 176);
}

/** Quadratic arc — Y axis uses screen coordinates (down is positive). */
export function parabolicLerp(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  amount: number,
  intensity = 1.2,
): { x: number; y: number } {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) {
    return { x: endX, y: endY };
  }

  const angle = Math.atan2(dy, dx);
  const midX = startX + Math.cos(angle) * (distance / 2);
  const midY =
    startY + Math.sin(angle) * (distance / 2) - (distance / 4) * intensity;
  const t = amount;

  return {
    x: (1 - t) ** 2 * startX + 2 * (1 - t) * t * midX + t ** 2 * endX,
    y: (1 - t) ** 2 * startY + 2 * (1 - t) * t * midY + t ** 2 * endY,
  };
}

export function randomPointInBounds(bounds: PocketBirdBounds): {
  x: number;
  y: number;
} {
  return {
    x: bounds.left + Math.random() * (bounds.right - bounds.left),
    y: bounds.top + Math.random() * (bounds.bottom - bounds.top),
  };
}

/** Resting Y for a bird standing on the floor of the arena. */
export function getGroundY(bounds: PocketBirdBounds): number {
  return bounds.bottom;
}

export function randomGroundPoint(bounds: PocketBirdBounds): {
  x: number;
  y: number;
} {
  return {
    x: bounds.left + Math.random() * (bounds.right - bounds.left),
    y: getGroundY(bounds),
  };
}

export function pickHopTargetX(
  birdX: number,
  bounds: PocketBirdBounds,
  hopDistance: number,
): number {
  if (
    (Math.random() < 0.5 && birdX - hopDistance > bounds.left) ||
    birdX + hopDistance > bounds.right
  ) {
    return birdX - hopDistance;
  }
  return birdX + hopDistance;
}

export function advanceParabolicPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  birdX: number,
  birdY: number,
  stateStart: number,
  speed: number,
  arenaSize: number,
  intensity = 2.5,
): { x: number; y: number; complete: boolean; facingRight: boolean } {
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const elapsed = Date.now() - stateStart;
  let effectiveSpeed = speed;
  if (distance > arenaSize / 2) {
    effectiveSpeed *= 1.3;
  }

  const amount = Math.min(1, elapsed / (distance / effectiveSpeed || 1));
  const { x, y } = parabolicLerp(
    startX,
    startY,
    targetX,
    targetY,
    amount,
    intensity,
  );

  const complete =
    Math.abs(x - targetX) < 1 && Math.abs(y - targetY) < 1;

  return {
    x: complete ? targetX : x,
    y: complete ? targetY : y,
    complete,
    facingRight: targetX > birdX,
  };
}
