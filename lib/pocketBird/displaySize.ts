import { POCKET_BIRD_GRID } from "@/lib/pocketBird/matchSpecies";

/** Snap display size to an integer upscale of the 32×32 sprite grid. */
export function resolvePocketBirdDisplaySize(requestedSize: number): {
  pixelSize: number;
  displaySize: number;
} {
  const pixelSize = Math.max(1, Math.floor(requestedSize / POCKET_BIRD_GRID));
  return {
    pixelSize,
    displaySize: pixelSize * POCKET_BIRD_GRID,
  };
}
