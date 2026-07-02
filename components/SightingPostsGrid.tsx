import { Dimensions, Image, Pressable, Text, View } from "react-native";
import { Feather } from "lucide-react-native";
import { AudioPostThumb } from "@/components/AudioPostThumb";
import { isAudioSighting, isPhotoSighting } from "@/lib/sightingMedia";
import type { Sighting } from "@/types";
const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const H_PADDING = 16;

interface SightingPostsGridProps {
  sightings: Sighting[];
  onPressSighting: (sightingId: string) => void;
  emptyLabel?: string;
}

export function SightingPostsGrid({
  sightings,
  onPressSighting,
  emptyLabel = "No sightings yet.",
}: SightingPostsGridProps) {
  const cellSize =
    (Dimensions.get("window").width - H_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
    GRID_COLUMNS;

  if (sightings.length === 0) {
    return (
      <View className="items-center py-10">
        <Feather size={28} color="#3a4e35" />
        <Text className="mt-3 font-sans text-sm text-muted-foreground">{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: GRID_GAP,
      }}
    >
      {sightings.map((sighting) => (
        <Pressable
          key={sighting.id}
          onPress={() => onPressSighting(sighting.id)}
          style={{ width: cellSize, height: cellSize }}
          className="overflow-hidden bg-muted active:opacity-90"
        >
          {isPhotoSighting(sighting) ? (
            <Image
              source={{ uri: sighting.photo_url! }}
              style={{ width: cellSize, height: cellSize }}
              resizeMode="cover"
            />
          ) : isAudioSighting(sighting) ? (
            <AudioPostThumb size="md" className="h-full w-full" />
          ) : (
            <View className="h-full w-full items-center justify-center bg-muted">
              <Feather size={22} color="#3a4e35" />
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}
