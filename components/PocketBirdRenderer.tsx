import { useMemo } from "react";
import Svg, { Rect } from "react-native-svg";
import { POCKET_BIRD_GRID } from "@/lib/pocketBird/matchSpecies";
import type { PocketBirdPixel } from "@/lib/pocketBird/render";

interface PocketBirdRendererProps {
  pixels: PocketBirdPixel[];
  size: number;
}

export function PocketBirdRenderer({ pixels, size }: PocketBirdRendererProps) {
  const runs = useMemo(() => compressPixelRuns(pixels), [pixels]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${POCKET_BIRD_GRID} ${POCKET_BIRD_GRID}`}
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
