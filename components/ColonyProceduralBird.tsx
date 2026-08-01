import { useMemo } from "react";
import Svg, { Rect } from "react-native-svg";
import {
  COLONY_GRID,
  colorsForBird,
  getBirdShapePixels,
  type BirdLayer,
} from "@/lib/colonyBirdShapes";
import type { FieldGuideEntry } from "@/lib/fieldGuide";

interface ColonyProceduralBirdProps {
  entry: FieldGuideEntry;
  size: number;
  /** 0–1 walk cycle phase for leg bob */
  walkPhase?: number;
}

const LAYER_ORDER: BirdLayer[] = [
  "tail",
  "leg",
  "wing",
  "body",
  "belly",
  "mark",
  "beak",
  "crest",
  "eye",
];

function legOffset(layer: BirdLayer, walkPhase: number): number {
  if (layer !== "leg") return 0;
  const bob = Math.sin(walkPhase * Math.PI * 2);
  return bob > 0 ? -1 : bob < -0.3 ? 1 : 0;
}

/** 48×48 pixel bird shaped and colored from species taxonomy. */
export function ColonyProceduralBird({
  entry,
  size,
  walkPhase = 0,
}: ColonyProceduralBirdProps) {
  const { pixels, colors } = useMemo(() => {
    const { pixels: shapePixels } = getBirdShapePixels(entry);
    const palette = colorsForBird(entry);
    return {
      pixels: shapePixels,
      colors: palette,
    };
  }, [entry]);

  const sorted = useMemo(() => {
    const order = new Map(LAYER_ORDER.map((layer, i) => [layer, i]));
    return [...pixels].sort(
      (a, b) => (order.get(a.layer) ?? 0) - (order.get(b.layer) ?? 0),
    );
  }, [pixels]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${COLONY_GRID} ${COLONY_GRID}`}>
      {sorted.map((pixel, index) => {
        const dy = legOffset(pixel.layer, walkPhase);
        return (
          <Rect
            key={`${pixel.x}-${pixel.y}-${pixel.layer}-${index}`}
            x={pixel.x}
            y={pixel.y + dy}
            width={1}
            height={1}
            fill={colors[pixel.layer]}
          />
        );
      })}
    </Svg>
  );
}
