import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { PocketBirdRenderer } from "@/components/PocketBirdRenderer";
import { POCKET_BIRD_GRID } from "@/lib/pocketBird/matchSpecies";
import {
  getPocketBirdHatPreviewLayer,
  listPocketBirdHats,
  NO_HAT_ID,
  type PocketBirdHat,
  type PocketBirdHatId,
} from "@/lib/pocketBird/hats";
import type { PocketBirdPixel } from "@/lib/pocketBird/render";

interface PocketBirdHatPickerProps {
  selectedId: PocketBirdHatId;
  onSelect: (hatId: PocketBirdHatId) => void;
}

const PREVIEW_SIZE = 56;

function hatLayerToPixels(grid: string[][]): PocketBirdPixel[] {
  const pixels: PocketBirdPixel[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y]!.length; x++) {
      const fill = grid[y]![x]!;
      if (fill !== "transparent") {
        pixels.push({ x, y, fill });
      }
    }
  }
  return scaleHatPreviewPixels(pixels);
}

/** Scale hat sprites to the largest integer size that fits in the grid without gaps. */
function scaleHatPreviewPixels(pixels: PocketBirdPixel[]): PocketBirdPixel[] {
  if (pixels.length === 0) return pixels;

  const bounds = getPixelBounds(pixels);
  const factor = Math.max(
    1,
    Math.min(
      Math.floor(POCKET_BIRD_GRID / bounds.width),
      Math.floor(POCKET_BIRD_GRID / bounds.height),
    ),
  );

  if (factor <= 1) {
    return centerPixelsInGrid(pixels);
  }

  const scaled: PocketBirdPixel[] = [];
  for (const pixel of pixels) {
    const localX = pixel.x - bounds.minX;
    const localY = pixel.y - bounds.minY;
    for (let dy = 0; dy < factor; dy++) {
      for (let dx = 0; dx < factor; dx++) {
        scaled.push({
          x: localX * factor + dx,
          y: localY * factor + dy,
          fill: pixel.fill,
        });
      }
    }
  }

  return centerPixelsInGrid(scaled);
}

function getPixelBounds(pixels: PocketBirdPixel[]): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pixel of pixels) {
    minX = Math.min(minX, pixel.x);
    minY = Math.min(minY, pixel.y);
    maxX = Math.max(maxX, pixel.x);
    maxY = Math.max(maxY, pixel.y);
  }

  return {
    minX,
    minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function centerPixelsInGrid(pixels: PocketBirdPixel[]): PocketBirdPixel[] {
  if (pixels.length === 0) return pixels;

  const bounds = getPixelBounds(pixels);
  const offsetX =
    Math.floor((POCKET_BIRD_GRID - bounds.width) / 2) - bounds.minX;
  const offsetY =
    Math.floor((POCKET_BIRD_GRID - bounds.height) / 2) - bounds.minY;

  return pixels.map((pixel) => ({
    x: pixel.x + offsetX,
    y: pixel.y + offsetY,
    fill: pixel.fill,
  }));
}

function HatTile({
  hat,
  selected,
  onPress,
}: {
  hat: PocketBirdHat | { id: typeof NO_HAT_ID; name: string };
  selected: boolean;
  onPress: () => void;
}) {
  const pixels = useMemo(() => {
    if (hat.id === NO_HAT_ID) return [];
    const layer = getPocketBirdHatPreviewLayer(hat.id);
    return layer ? hatLayerToPixels(layer) : [];
  }, [hat.id]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="items-center rounded-xl border p-2"
      style={{
        width: "23%",
        margin: "1%",
        borderColor: selected ? "#5f9470" : "transparent",
        backgroundColor: selected ? "#5f947018" : undefined,
      }}
    >
      {pixels.length > 0 ? (
        <PocketBirdRenderer pixels={pixels} size={PREVIEW_SIZE} />
      ) : (
        <View
          className="items-center justify-center"
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
        >
          <Text className="font-sans text-lg text-muted-foreground">—</Text>
        </View>
      )}
      <Text
        className="mt-1 text-center font-sans text-[10px] text-foreground"
        numberOfLines={2}
      >
        {hat.name}
      </Text>
    </Pressable>
  );
}

export function PocketBirdHatPicker({ selectedId, onSelect }: PocketBirdHatPickerProps) {
  const hats = useMemo(() => listPocketBirdHats(), []);

  return (
    <View className="mt-2 flex-1">
      <Text className="mb-2 font-serif-semibold text-base text-foreground">
        Choose your hat
      </Text>
      <Text className="mb-3 font-sans text-xs text-muted-foreground">
        Stays on when you switch birds · only you see it
      </Text>

      <View className="flex-row flex-wrap">
        <HatTile
          hat={{ id: NO_HAT_ID, name: "No hat" }}
          selected={selectedId === NO_HAT_ID}
          onPress={() => onSelect(NO_HAT_ID)}
        />
        {hats.map((hat) => (
          <HatTile
            key={hat.id}
            hat={hat}
            selected={selectedId === hat.id}
            onPress={() => onSelect(hat.id)}
          />
        ))}
      </View>
    </View>
  );
}
