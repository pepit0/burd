import { useMemo } from "react";
import { View } from "react-native";
import { resolvePocketBirdDisplaySize } from "@/lib/pocketBird/displaySize";
import type { PocketBirdPixel } from "@/lib/pocketBird/render";

interface PocketBirdRendererProps {
  pixels: PocketBirdPixel[];
  size: number;
}

export function PocketBirdRenderer({ pixels, size }: PocketBirdRendererProps) {
  const { pixelSize, displaySize } = useMemo(
    () => resolvePocketBirdDisplaySize(size),
    [size],
  );
  const runs = useMemo(() => compressPixelRuns(pixels), [pixels]);

  return (
    <View style={{ width: displaySize, height: displaySize }}>
      {runs.map((run, index) => (
        <View
          key={`${run.x}-${run.y}-${run.width}-${run.fill}-${index}`}
          style={{
            position: "absolute",
            left: run.x * pixelSize,
            top: run.y * pixelSize,
            width: run.width * pixelSize,
            height: pixelSize,
            backgroundColor: run.fill,
          }}
        />
      ))}
    </View>
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
