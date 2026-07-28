import { Pressable, Text, View } from "react-native";
import { Grid3X3 } from "lucide-react-native";

export type ProfilePostsFilter = "all" | "photos" | "audio" | "reposts";

const OPTIONS: { id: ProfilePostsFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "photos", label: "Photos" },
  { id: "audio", label: "Audio" },
  { id: "reposts", label: "Reposts" },
];

interface ProfilePostsFilterProps {
  value: ProfilePostsFilter;
  onChange: (value: ProfilePostsFilter) => void;
}

export function ProfilePostsFilterBar({ value, onChange }: ProfilePostsFilterProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-2.5">
      <View className="flex-row items-center gap-2">
        <Grid3X3 size={14} color="#c8893a" />
        <Text className="font-sans-medium text-xs uppercase tracking-wider text-foreground">
          Posts
        </Text>
      </View>
      <View className="shrink flex-row flex-wrap items-center justify-end gap-2">
        {OPTIONS.map((option) => {
          const active = value === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              className={`rounded-full px-3 py-1 ${
                active ? "bg-primary" : "border border-border bg-card"
              }`}
            >
              <Text
                className={`text-xs ${
                  active ? "font-sans-medium text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function filterProfileSightings<T extends { photo_url?: string | null; audio_url?: string | null }>(
  sightings: T[],
  filter: ProfilePostsFilter,
): T[] {
  if (filter === "photos") {
    return sightings.filter((s) => Boolean(s.photo_url) && !s.audio_url);
  }
  if (filter === "audio") {
    return sightings.filter((s) => Boolean(s.audio_url));
  }
  return sightings;
}
