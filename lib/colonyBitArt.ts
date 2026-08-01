/** Internal pixel resolution — rendered upscaled for a chunky retro look. */
export const COLONY_BIT_GRID = 128;
export const COLONY_BIT_COLORS = 32;
export const OUTLINE = "#141814";

export interface BitPixel {
  x: number;
  y: number;
  fill: string;
}

interface RgbaGrid {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function hex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function colorDist(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/** Snap colors to a limited retro palette. */
export function quantizeColor(r: number, g: number, b: number): string {
  const levels = 9;
  const step = 255 / (levels - 1);
  const snap = (v: number) => Math.round(v / step) * step;
  return hex(snap(r), snap(g), snap(b));
}

function cornerBackground(grid: RgbaGrid): [number, number, number] {
  const { width, height, data } = grid;
  const samples: [number, number, number][] = [];
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [1, 1],
    [width - 2, height - 2],
  ];
  for (const [x, y] of points) {
    const i = (y * width + x) * 4;
    samples.push([data[i]!, data[i + 1]!, data[i + 2]!]);
  }
  const r = samples.reduce((s, c) => s + c[0], 0) / samples.length;
  const g = samples.reduce((s, c) => s + c[1], 0) / samples.length;
  const b = samples.reduce((s, c) => s + c[2], 0) / samples.length;
  return [r, g, b];
}

function isBackground(
  r: number,
  g: number,
  b: number,
  bg: [number, number, number],
): boolean {
  if (colorDist([r, g, b], bg) < 900) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return max > 210 && sat < 0.18;
}

function buildPalette(samples: string[]): string[] {
  const counts = new Map<string, number>();
  for (const color of samples) {
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, COLONY_BIT_COLORS)
    .map(([color]) => color);
}

function nearestPalette(
  r: number,
  g: number,
  b: number,
  palette: string[],
): string {
  let best = palette[0] ?? OUTLINE;
  let bestDist = Infinity;
  for (const color of palette) {
    const cr = parseInt(color.slice(1, 3), 16);
    const cg = parseInt(color.slice(3, 5), 16);
    const cb = parseInt(color.slice(5, 7), 16);
    const d = colorDist([r, g, b], [cr, cg, cb]);
    if (d < bestDist) {
      bestDist = d;
      best = color;
    }
  }
  return best;
}

/** Convert raw RGBA samples into a limited-palette pixel sprite with outlines. */
export function rgbaGridToBitPixels(grid: RgbaGrid): BitPixel[] {
  const { width, height, data } = grid;
  const bg = cornerBackground(grid);
  const fills: Array<string | null> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;

      if (a < 20 || isBackground(r, g, b, bg)) {
        fills.push(null);
        continue;
      }
      fills.push(quantizeColor(r, g, b));
    }
  }

  const opaqueColors = fills.filter((c): c is string => c !== null);
  const palette = buildPalette(opaqueColors);
  const mapped = fills.map((color) =>
    color ? nearestPalette(
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
      palette,
    ) : null,
  );

  const out: BitPixel[] = [];
  const index = (x: number, y: number) => y * width + x;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fill = mapped[index(x, y)];
      if (!fill) continue;

      const neighbors = [
        x > 0 ? mapped[index(x - 1, y)] : null,
        x < width - 1 ? mapped[index(x + 1, y)] : null,
        y > 0 ? mapped[index(x, y - 1)] : null,
        y < height - 1 ? mapped[index(x, y + 1)] : null,
      ];

      const onEdge = neighbors.some((n) => n === null);
      out.push({ x, y, fill: onEdge ? OUTLINE : fill });
    }
  }

  return out;
}

export function bitPixelsFromRgba(
  width: number,
  height: number,
  data: Uint8Array | Uint8ClampedArray,
): BitPixel[] {
  return rgbaGridToBitPixels({
    width,
    height,
    data: data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data),
  });
}
