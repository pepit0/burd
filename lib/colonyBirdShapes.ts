import type { FieldGuideEntry } from "@/lib/fieldGuide";
import { appearanceForEntry } from "@/lib/colonyBirdAppearance";

export const COLONY_GRID = 48;

export type BirdLayer =
  | "body"
  | "wing"
  | "belly"
  | "beak"
  | "eye"
  | "leg"
  | "tail"
  | "crest"
  | "mark"
  | "outline";

export type BirdArchetype =
  | "songbird"
  | "wader"
  | "duck"
  | "raptor"
  | "hummingbird"
  | "woodpecker"
  | "gamebird"
  | "swallow";

export interface ColonyPixel {
  x: number;
  y: number;
  layer: BirdLayer;
}

const BASE_GRID = 32;

function px(coords: Array<[number, number]>, layer: BirdLayer): ColonyPixel[] {
  return coords.map(([x, y]) => ({ x, y, layer }));
}

function upscaleShape(pixels: ColonyPixel[]): ColonyPixel[] {
  const out: ColonyPixel[] = [];
  const seen = new Set<string>();
  const offset = Math.floor((COLONY_GRID - BASE_GRID * 1.5) / 2);

  for (const pixel of pixels) {
    const bx = Math.round(pixel.x * 1.5) + offset;
    const by = Math.round(pixel.y * 1.5) + offset;
    const block: Array<[number, number]> = [
      [bx, by],
      [bx + 1, by],
      [bx, by + 1],
      [bx + 1, by + 1],
    ];

    for (const [x, y] of block) {
      if (x < 0 || y < 0 || x >= COLONY_GRID || y >= COLONY_GRID) continue;
      const key = `${x},${y},${pixel.layer}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ x, y, layer: pixel.layer });
    }
  }

  return out;
}

const SONGBIRD = upscaleShape([
  ...px(
    [
      [13, 10], [14, 10], [15, 10], [16, 10], [17, 10],
      [12, 11], [13, 11], [14, 11], [15, 11], [16, 11], [17, 11], [18, 11],
      [11, 12], [12, 12], [13, 12], [14, 12], [15, 12], [16, 12], [17, 12], [18, 12], [19, 12],
      [11, 13], [12, 13], [13, 13], [14, 13], [15, 13], [16, 13], [17, 13], [18, 13], [19, 13],
      [12, 14], [13, 14], [14, 14], [15, 14], [16, 14], [17, 14], [18, 14],
      [13, 15], [14, 15], [15, 15], [16, 15], [17, 15],
    ],
    "body",
  ),
  ...px([[10, 12], [10, 13], [9, 13], [20, 12], [20, 13], [21, 13]], "wing"),
  ...px([[14, 14], [15, 14], [16, 14], [15, 15], [16, 15]], "belly"),
  ...px([[19, 11], [20, 11], [21, 11], [22, 12]], "beak"),
  ...px([[17, 12]], "eye"),
  ...px([[14, 16], [15, 16], [16, 16], [17, 16], [15, 17], [16, 17]], "leg"),
  ...px([[10, 13], [9, 14], [8, 15]], "tail"),
]);

const WADER = upscaleShape([
  ...px(
    [
      [14, 6], [15, 6], [16, 6], [17, 6],
      [14, 7], [15, 7], [16, 7], [17, 7],
      [15, 8], [16, 8],
      [14, 9], [15, 9], [16, 9], [17, 9],
      [13, 10], [14, 10], [15, 10], [16, 10], [17, 10], [18, 10],
      [12, 11], [13, 11], [14, 11], [15, 11], [16, 11], [17, 11], [18, 11], [19, 11],
      [12, 12], [13, 12], [14, 12], [15, 12], [16, 12], [17, 12], [18, 12],
    ],
    "body",
  ),
  ...px([[11, 11], [10, 12], [19, 11], [20, 12]], "wing"),
  ...px([[15, 11], [16, 11], [15, 12], [16, 12]], "belly"),
  ...px([[18, 9], [19, 9], [20, 9], [21, 10], [22, 10]], "beak"),
  ...px([[16, 8]], "eye"),
  ...px(
    [[13, 13], [14, 14], [14, 15], [14, 16], [14, 17], [17, 13], [18, 14], [18, 15], [18, 16], [18, 17]],
    "leg",
  ),
  ...px([[11, 12], [10, 13]], "tail"),
]);

const DUCK = upscaleShape([
  ...px(
    [
      [10, 14], [11, 14], [12, 14], [13, 14], [14, 14], [15, 14], [16, 14], [17, 14], [18, 14], [19, 14], [20, 14], [21, 14],
      [9, 15], [10, 15], [11, 15], [12, 15], [13, 15], [14, 15], [15, 15], [16, 15], [17, 15], [18, 15], [19, 15], [20, 15], [21, 15], [22, 15],
      [10, 16], [11, 16], [12, 16], [13, 16], [14, 16], [15, 16], [16, 16], [17, 16], [18, 16], [19, 16], [20, 16], [21, 16],
      [11, 17], [12, 17], [13, 17], [14, 17], [15, 17], [16, 17], [17, 17], [18, 17], [19, 17], [20, 17],
    ],
    "body",
  ),
  ...px([[8, 15], [7, 16], [22, 15], [23, 16]], "wing"),
  ...px([[14, 16], [15, 16], [16, 16], [17, 16]], "belly"),
  ...px([[12, 13], [13, 13], [14, 13], [15, 13], [16, 13], [17, 13], [18, 13]], "beak"),
  ...px([[15, 14]], "eye"),
  ...px([[13, 18], [14, 19], [18, 18], [19, 19]], "leg"),
  ...px([[9, 16], [8, 17]], "tail"),
  ...px([[14, 12], [15, 12], [16, 12]], "mark"),
]);

const RAPTOR = upscaleShape([
  ...px(
    [
      [14, 9], [15, 9], [16, 9], [17, 9],
      [13, 10], [14, 10], [15, 10], [16, 10], [17, 10], [18, 10],
      [12, 11], [13, 11], [14, 11], [15, 11], [16, 11], [17, 11], [18, 11], [19, 11],
      [13, 12], [14, 12], [15, 12], [16, 12], [17, 12], [18, 12],
      [14, 13], [15, 13], [16, 13], [17, 13],
    ],
    "body",
  ),
  ...px(
    [
      [6, 11], [7, 11], [8, 11], [9, 11], [10, 11],
      [6, 12], [7, 12], [8, 12], [9, 12],
      [20, 11], [21, 11], [22, 11], [23, 11], [24, 11],
      [22, 12], [23, 12], [24, 12], [25, 12],
    ],
    "wing",
  ),
  ...px([[15, 12], [16, 12], [15, 13], [16, 13]], "belly"),
  ...px([[18, 10], [19, 10], [20, 10], [21, 11]], "beak"),
  ...px([[16, 10]], "eye"),
  ...px([[14, 14], [15, 15], [16, 14], [17, 15]], "leg"),
  ...px([[11, 12], [10, 13], [9, 14], [8, 15]], "tail"),
  ...px([[15, 8], [16, 8]], "crest"),
]);

const HUMMINGBIRD = upscaleShape([
  ...px([[14, 12], [15, 12], [16, 12], [15, 13], [16, 13]], "body"),
  ...px([[13, 13], [14, 13], [16, 13], [17, 13]], "belly"),
  ...px(
    [
      [8, 11], [9, 11], [10, 12], [11, 12],
      [20, 11], [21, 11], [22, 12], [23, 12],
      [7, 12], [24, 12],
    ],
    "wing",
  ),
  ...px([[17, 12], [18, 12], [19, 12], [20, 12], [21, 13]], "beak"),
  ...px([[16, 12]], "eye"),
  ...px([[14, 14], [16, 14]], "leg"),
  ...px([[12, 13], [11, 14], [10, 15]], "tail"),
  ...px([[15, 11], [16, 11]], "mark"),
]);

const WOODPECKER = upscaleShape([
  ...px(
    [
      [14, 8], [15, 8], [16, 8], [17, 8],
      [13, 9], [14, 9], [15, 9], [16, 9], [17, 9], [18, 9],
      [13, 10], [14, 10], [15, 10], [16, 10], [17, 10], [18, 10],
      [14, 11], [15, 11], [16, 11], [17, 11],
      [15, 12], [16, 12],
    ],
    "body",
  ),
  ...px([[11, 10], [12, 10], [19, 10], [20, 10]], "wing"),
  ...px([[15, 11], [16, 11]], "belly"),
  ...px([[18, 9], [19, 9], [20, 10]], "beak"),
  ...px([[16, 9]], "eye"),
  ...px([[14, 13], [15, 14], [16, 13], [17, 14]], "leg"),
  ...px([[15, 13], [15, 14], [15, 15], [15, 16], [15, 17], [15, 18]], "tail"),
  ...px([[14, 7], [15, 7], [16, 7], [17, 7], [15, 6], [16, 6]], "crest"),
  ...px([[14, 10], [17, 10]], "mark"),
]);

const GAMEBIRD = upscaleShape([
  ...px([[14, 10], [15, 10], [16, 10], [17, 10]], "body"),
  ...px(
    [
      [11, 11], [12, 11], [13, 11], [14, 11], [15, 11], [16, 11], [17, 11], [18, 11], [19, 11], [20, 11],
      [10, 12], [11, 12], [12, 12], [13, 12], [14, 12], [15, 12], [16, 12], [17, 12], [18, 12], [19, 12], [20, 12], [21, 12],
      [10, 13], [11, 13], [12, 13], [13, 13], [14, 13], [15, 13], [16, 13], [17, 13], [18, 13], [19, 13], [20, 13], [21, 13],
      [11, 14], [12, 14], [13, 14], [14, 14], [15, 14], [16, 14], [17, 14], [18, 14], [19, 14], [20, 14],
      [12, 15], [13, 15], [14, 15], [15, 15], [16, 15], [17, 15], [18, 15], [19, 15],
    ],
    "body",
  ),
  ...px([[9, 13], [8, 14], [21, 13], [22, 14]], "wing"),
  ...px([[14, 13], [15, 13], [16, 13], [17, 13]], "belly"),
  ...px([[18, 10], [19, 10], [20, 11]], "beak"),
  ...px([[16, 10]], "eye"),
  ...px([[13, 16], [14, 17], [17, 16], [18, 17]], "leg"),
  ...px([[10, 14], [9, 15]], "tail"),
  ...px([[12, 12], [19, 12]], "mark"),
]);

const SWALLOW = upscaleShape([
  ...px(
    [
      [14, 10], [15, 10], [16, 10], [17, 10],
      [13, 11], [14, 11], [15, 11], [16, 11], [17, 11], [18, 11],
      [13, 12], [14, 12], [15, 12], [16, 12], [17, 12], [18, 12],
      [14, 13], [15, 13], [16, 13], [17, 13],
    ],
    "body",
  ),
  ...px(
    [
      [7, 10], [8, 10], [9, 11], [10, 11], [11, 11],
      [20, 10], [21, 10], [22, 11], [23, 11], [24, 11],
    ],
    "wing",
  ),
  ...px([[15, 12], [16, 12]], "belly"),
  ...px([[18, 11], [19, 11], [20, 11]], "beak"),
  ...px([[16, 11]], "eye"),
  ...px([[14, 14], [15, 15], [17, 14], [18, 15]], "leg"),
  ...px([[12, 13], [11, 14], [10, 15], [9, 16], [19, 13], [20, 14], [21, 15], [22, 16]], "tail"),
  ...px([[15, 10], [16, 10]], "mark"),
]);

const ARCHETYPE_SHAPES: Record<BirdArchetype, ColonyPixel[]> = {
  songbird: SONGBIRD,
  wader: WADER,
  duck: DUCK,
  raptor: RAPTOR,
  hummingbird: HUMMINGBIRD,
  woodpecker: WOODPECKER,
  gamebird: GAMEBIRD,
  swallow: SWALLOW,
};

export function pickBirdArchetype(entry: FieldGuideEntry): BirdArchetype {
  return appearanceForEntry(entry).archetype;
}

export function getBirdShapePixels(entry: FieldGuideEntry): {
  archetype: BirdArchetype;
  pixels: ColonyPixel[];
} {
  const archetype = pickBirdArchetype(entry);
  return { archetype, pixels: ARCHETYPE_SHAPES[archetype] };
}

export function colorsForBird(entry: FieldGuideEntry): Record<BirdLayer, string> {
  const appearance = appearanceForEntry(entry);
  return {
    body: appearance.body,
    wing: appearance.wing,
    belly: appearance.belly,
    beak: appearance.beak,
    eye: "#181e16",
    leg: appearance.leg,
    tail: appearance.tail,
    crest: appearance.crest,
    mark: appearance.mark,
    outline: "#181e16",
  };
}

export function birdFootprint(archetype: BirdArchetype): { w: number; h: number } {
  switch (archetype) {
    case "wader":
      return { w: 20, h: 26 };
    case "duck":
      return { w: 24, h: 18 };
    case "raptor":
      return { w: 30, h: 20 };
    case "hummingbird":
      return { w: 26, h: 14 };
    case "woodpecker":
      return { w: 18, h: 28 };
    case "gamebird":
      return { w: 20, h: 18 };
    case "swallow":
      return { w: 26, h: 18 };
    default:
      return { w: 18, h: 18 };
  }
}
