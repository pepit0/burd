import { Pressable, Text, View } from "react-native";

export type ProfilePostsFilter = "all" | "photos" | "audio";

const OPTIONS: { id: ProfilePostsFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "photos", label: "Photos" },
  { id: "audio", label: "Audio" },
];

interface ProfilePostsFilterProps {
  value: ProfilePostsFilter;
  onChange: (value: ProfilePostsFilter) => void;
}

export function ProfilePostsFilterBar({ value, onChange }: ProfilePostsFilterProps) {
  return (
    <View className="flex-row items-center justify-center gap-2 border-b border-border py-2.5">
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
