import { useMemo } from "react";
import Svg, { Rect } from "react-native-svg";
import { COLONY_BIT_GRID, type BitPixel } from "@/lib/colonyBitArt";

interface ColonyBitBirdRendererProps {
  pixels: BitPixel[];
  size: number;
}

interface PixelRun {
  x: number;
  y: number;
  width: number;
  fill: string;
}

/** Merge adjacent same-color pixels per row to keep SVG node count manageable. */
function compressPixelRuns(pixels: BitPixel[]): PixelRun[] {
  const rows = new Map<number, BitPixel[]>();
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

/** Renders a bit-art sprite as crisp SVG pixel squares. */
export function ColonyBitBirdRenderer({ pixels, size }: ColonyBitBirdRendererProps) {
  const runs = useMemo(() => compressPixelRuns(pixels), [pixels]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${COLONY_BIT_GRID} ${COLONY_BIT_GRID}`}
    >
      {runs.map((run, index) => (
        <Rect
          key={`${run.x}-${run.y}-${run.width}-${run.fill}-${index}`}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          fill={run.fill}
        />
      ))}
    </Svg>
  );
}
