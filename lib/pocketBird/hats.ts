import pocketBirdAssets from "@/data/pocket-bird/assets.json";
import type { PocketBirdFrameId } from "@/lib/pocketBird/animations";

export type PocketBirdHatId = (typeof pocketBirdAssets.hats)[keyof typeof pocketBirdAssets.hats];

export interface PocketBirdHat {
  id: PocketBirdHatId;
  name: string;
  description: string;
}

const assets = pocketBirdAssets;
const HAT_WIDTH = assets.hatWidth;
export const NO_HAT_ID: PocketBirdHatId = assets.hats.NONE;

const hatIds = Object.values(assets.hats).filter((id) => id !== NO_HAT_ID);

export function listPocketBirdHats(): PocketBirdHat[] {
  return hatIds.map((id) => ({
    id,
    name: assets.hatMetadata[id as keyof typeof assets.hatMetadata].name,
    description: assets.hatMetadata[id as keyof typeof assets.hatMetadata].description,
  }));
}

export function getPocketBirdHatById(id: string): PocketBirdHat | null {
  if (id === NO_HAT_ID || !(id in assets.hatMetadata)) return null;
  const meta = assets.hatMetadata[id as keyof typeof assets.hatMetadata];
  return { id: id as PocketBirdHatId, name: meta.name, description: meta.description };
}

export function isPocketBirdHatId(id: string): id is PocketBirdHatId {
  return id in assets.hatMetadata;
}

function getHatSpriteSheet(): string[][] {
  return assets.hatPixels;
}

function getHatIndex(hatId: PocketBirdHatId): number {
  return Object.values(assets.hats).indexOf(hatId) - 1;
}

function getHatLayerPixels(spriteSheet: string[][], hatIndex: number): string[][] {
  const layer: string[][] = [];
  for (let y = 0; y < HAT_WIDTH; y++) {
    layer.push(
      spriteSheet[y]!.slice(hatIndex * HAT_WIDTH, (hatIndex + 1) * HAT_WIDTH),
    );
  }
  return layer;
}

function pad(
  pixels: string[][],
  top: number,
  bottom: number,
  left: number,
  right: number,
): string[][] {
  const paddedPixels: string[][] = [];
  const rowLength = pixels[0]!.length + left + right;

  for (let y = 0; y < top; y++) {
    paddedPixels.push(Array.from({ length: rowLength }, () => "transparent"));
  }

  for (let y = 0; y < pixels.length; y++) {
    const row: string[] = [];
    for (let x = 0; x < left; x++) row.push("transparent");
    for (let x = 0; x < pixels[y]!.length; x++) row.push(pixels[y]![x]!);
    for (let x = 0; x < right; x++) row.push("transparent");
    paddedPixels.push(row);
  }

  for (let y = 0; y < bottom; y++) {
    paddedPixels.push(Array.from({ length: rowLength }, () => "transparent"));
  }

  return paddedPixels;
}

function drawOutline(pixels: string[][], outlineBottom = false): string[][] {
  const result = pixels.map((row) => row.slice());
  let neighborOffsets: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [-1, -1],
    [1, -1],
  ];
  if (outlineBottom) {
    neighborOffsets = [...neighborOffsets, [0, 1], [-1, 1], [1, 1]];
  }

  for (let y = 0; y < result.length; y++) {
    for (let x = 0; x < result[y]!.length; x++) {
      const pixel = result[y]![x]!;
      if (pixel !== "transparent" && pixel !== "#ffffff") {
        for (const [dx, dy] of neighborOffsets) {
          const newX = x + dx;
          const newY = y + dy;
          if (
            newY >= 0 &&
            newY < result.length &&
            newX >= 0 &&
            newX < result[newY]!.length &&
            result[newY]![newX] === "transparent"
          ) {
            result[newY]![newX] = "#ffffff";
          }
        }
      }
    }
  }

  return result;
}

function pushToBottom(pixels: string[][]): string[][] {
  let trimmed = pixels.slice();
  let trimCount = 0;
  while (trimmed.length > 1) {
    const lastRow = trimmed[trimmed.length - 1]!;
    if (lastRow.every((pixel) => pixel === "transparent")) {
      trimmed.pop();
      trimCount += 1;
    } else {
      break;
    }
  }
  return pad(trimmed, trimCount, 0, 0, 0);
}

function buildWornHatLayer(hatId: PocketBirdHatId, yOffset = 0): string[][] {
  const LEFT_PADDING = 6;
  const RIGHT_PADDING = 14;
  const TOP_PADDING = 5 + yOffset;
  const BOTTOM_PADDING = Math.max(0, 15 - yOffset);

  const sheet = getHatSpriteSheet();
  const hatIndex = getHatIndex(hatId);
  let hatPixels = getHatLayerPixels(sheet, hatIndex);
  hatPixels = pad(hatPixels, TOP_PADDING, BOTTOM_PADDING, LEFT_PADDING, RIGHT_PADDING);
  return drawOutline(hatPixels, false);
}

function buildHatPreviewLayer(hatId: PocketBirdHatId): string[][] {
  const sheet = getHatSpriteSheet();
  const hatIndex = getHatIndex(hatId);
  let hatPixels = getHatLayerPixels(sheet, hatIndex);
  hatPixels = pad(hatPixels, 1, 1, 1, 1);
  hatPixels = drawOutline(hatPixels, true);
  return pushToBottom(hatPixels);
}

export function hatFrameUsesHeadDown(frameId: PocketBirdFrameId): boolean {
  return frameId === "headDown" || frameId === "wingsUp";
}

/** Hat layer grid (32×32) for a worn hat on the current animation frame. */
export function getPocketBirdHatLayer(
  hatId: PocketBirdHatId,
  frameId: PocketBirdFrameId,
): string[][] | null {
  if (hatId === NO_HAT_ID) return null;
  const yOffset = hatFrameUsesHeadDown(frameId) ? 1 : 0;
  return buildWornHatLayer(hatId, yOffset);
}

/** Inventory-style hat preview for picker tiles. */
export function getPocketBirdHatPreviewLayer(hatId: PocketBirdHatId): string[][] | null {
  if (hatId === NO_HAT_ID) return null;
  return buildHatPreviewLayer(hatId);
}
