import { colonySeed } from "@/lib/colonyLoggedSpecies";

export interface WanderPoint {
  x: number;
  y: number;
}

export interface WanderSegment {
  to: WanderPoint;
  duration: number;
  faceRight: boolean;
}

const MIN_SPEED = 28;
const MAX_SPEED = 52;

/** Random roam path that covers the full terrarium area. */
export function buildWanderPath(
  speciesKey: string,
  bounds: { width: number; height: number },
  spriteSize: number,
  inset: number,
  steps = 7,
): { start: WanderPoint; segments: WanderSegment[] } {
  const maxX = Math.max(bounds.width - spriteSize - inset, inset);
  const maxY = Math.max(bounds.height - spriteSize - inset, inset);

  const point = (salt: number): WanderPoint => ({
    x: inset + colonySeed(speciesKey, salt) * (maxX - inset),
    y: inset + colonySeed(speciesKey, salt + 50) * (maxY - inset),
  });

  const start = point(1);
  const waypoints: WanderPoint[] = [start];
  for (let i = 0; i < steps; i++) {
    waypoints.push(point(10 + i * 3));
  }

  const segments: WanderSegment[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    const from = waypoints[i]!;
    const to = waypoints[(i + 1) % waypoints.length]!;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const speed =
      MIN_SPEED + colonySeed(speciesKey, 90 + i) * (MAX_SPEED - MIN_SPEED);
    segments.push({
      to,
      duration: Math.max(800, Math.round((distance / speed) * 1000)),
      faceRight: dx >= 0,
    });
  }

  return { start, segments };
}
