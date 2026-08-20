import {
  POCKET_BIRD_GRID,
  getPocketBirdPalette,
  getPocketBirdSpecies,
  getPocketBirdSpriteSheet,
} from "@/lib/pocketBird/matchSpecies";
import type { PocketBirdFrameId } from "@/lib/pocketBird/animations";
import {
  getPocketBirdHatLayer,
  NO_HAT_ID,
  type PocketBirdHatId,
} from "@/lib/pocketBird/hats";

export interface PocketBirdPixel {
  x: number;
  y: number;
  fill: string;
}

function getLayerPixels(spriteSheet: string[][], spriteIndex: number): string[][] {
  const width = POCKET_BIRD_GRID;
  const layer: string[][] = [];
  for (let y = 0; y < width; y++) {
    layer.push(
      spriteSheet[y]!.slice(spriteIndex * width, (spriteIndex + 1) * width),
    );
  }
  return layer;
}

function combineLayers(layers: string[][][]): string[][] {
  const maxHeight = Math.max(...layers.map((layer) => layer.length));
  const width = layers[0]?.[0]?.length ?? POCKET_BIRD_GRID;
  const combined: string[][] = layers[0]!.map((row) => row.slice());

  while (combined.length < maxHeight) {
    combined.unshift(Array.from({ length: width }, () => "transparent"));
  }

  for (let i = 1; i < layers.length; i++) {
    const layer = layers[i]!;
    const topMargin = maxHeight - layer.length;
    for (let y = 0; y < layer.length; y++) {
      for (let x = 0; x < layer[y]!.length; x++) {
        const cell = layer[y]![x]!;
        if (cell !== "transparent") {
          combined[y + topMargin]![x] = cell;
        }
      }
    }
  }

  return combined;
}

function resolveCell(cell: string, palette: Record<string, string>): string | null {
  if (cell === "transparent") return null;
  if (cell.startsWith("#")) return cell;
  return palette[cell] ?? null;
}

function gridToPixels(
  grid: string[][],
  palette: Record<string, string>,
): PocketBirdPixel[] {
  const pixels: PocketBirdPixel[] = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]!;
    for (let x = 0; x < row.length; x++) {
      const fill = resolveCell(row[x]!, palette);
      if (fill) pixels.push({ x, y, fill });
    }
  }
  return pixels;
}

interface PixelRun {
  x: number;
  y: number;
  width: number;
  fill: string;
}

function compressPixelRuns(pixels: PocketBirdPixel[]): PixelRun[] {
  const rows = new Map<number, PocketBirdPixel[]>();
  for (const pixel of pixels) {
    const row = rows.get(pixel.y) ?? [];
    row.push(pixel);
    rows.set(pixel.y, row);
  }

  const runs: PixelRun[] = [];
  for (const [y, rowPixels] of rows) {
    rowPixels.sort((a, b) => a.x - b.x);
    let run: PixelRun | null = null;

    for (const pixel of rowPixels) {
      if (run && run.fill === pixel.fill && run.x + run.width === pixel.x) {
        run.width += 1;
        continue;
      }
      if (run) runs.push(run);
      run = { x: pixel.x, y, width: 1, fill: pixel.fill };
    }
    if (run) runs.push(run);
  }

  return runs;
}

/** One SVG for a sprite frame — cheaper than a View per pixel. */
export function pixelsToSvg(pixels: PocketBirdPixel[]): string {
  let maxX = POCKET_BIRD_GRID;
  let maxY = POCKET_BIRD_GRID;
  for (const pixel of pixels) {
    maxX = Math.max(maxX, pixel.x + 1);
    maxY = Math.max(maxY, pixel.y + 1);
  }

  const rects = compressPixelRuns(pixels)
    .map(
      (run) =>
        `<rect x="${run.x}" y="${run.y}" width="${run.width}" height="1" fill="${run.fill}"/>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}" width="${maxX}" height="${maxY}" shape-rendering="crispEdges">${rects}</svg>`;
}

function layerIndices(frameId: PocketBirdFrameId, hasTuft: boolean): number[] {
  switch (frameId) {
    case "base":
      return hasTuft ? [0, 5] : [0];
    case "headDown":
      return hasTuft ? [1, 6] : [1];
    case "wingsDown":
      return hasTuft ? [0, 5, 8] : [0, 8];
    case "wingsUp":
      return hasTuft ? [1, 6, 7] : [1, 7];
    case "heartOne":
      return hasTuft ? [0, 5, 9, 2] : [0, 9, 2];
    case "heartTwo":
      return hasTuft ? [0, 5, 9, 3] : [0, 9, 3];
    case "heartThree":
      return hasTuft ? [0, 5, 9, 4] : [0, 9, 4];
    case "heartFour":
      return hasTuft ? [0, 5, 9, 3] : [0, 9, 3];
    default:
      return [0];
  }
}

const frameCache = new Map<string, PocketBirdPixel[]>();

/** Render a single Pocket Bird frame for a species, optionally with a hat. */
export function getPocketBirdFrame(
  speciesId: string,
  frameId: PocketBirdFrameId,
  hatId: PocketBirdHatId = NO_HAT_ID,
): PocketBirdPixel[] {
  const key = `${speciesId}:${frameId}:${hatId}`;
  const cached = frameCache.get(key);
  if (cached) return cached;

  const species = getPocketBirdSpecies(speciesId);
  const palette = getPocketBirdPalette(speciesId);
  const sheet = getPocketBirdSpriteSheet();
  const hasTuft = species.tags?.includes("tuft") ?? false;
  const layerGrids = layerIndices(frameId, hasTuft).map((index) =>
    getLayerPixels(sheet, index),
  );

  const hatLayer = getPocketBirdHatLayer(hatId, frameId);
  if (hatLayer) {
    layerGrids.push(hatLayer);
  }

  const pixels = gridToPixels(combineLayers(layerGrids), palette);
  frameCache.set(key, pixels);
  return pixels;
}

/** @deprecated Use getPocketBirdFrame with BOB animation instead. */
export function getPocketBirdWalkFrame(
  speciesId: string,
  walkPhase: number,
): PocketBirdPixel[] {
  return getPocketBirdFrame(speciesId, walkPhase >= 0.5 ? "headDown" : "base");
}
