import { Pressable, Text, View } from "react-native";

export interface ProfileStat {
  label: string;
  value: number;
  onPress: () => void;
}

interface ProfileStatsRowProps {
  stats: ProfileStat[];
  variant?: "boxed" | "inline";
}

export function ProfileStatsRow({ stats, variant = "boxed" }: ProfileStatsRowProps) {
  if (variant === "inline") {
    return (
      <View className="flex-row items-end justify-end gap-5">
        {stats.map((s) => (
          <Pressable
            key={s.label}
            onPress={s.onPress}
            className="h-14 w-14 items-center justify-center rounded-md border border-border bg-card active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={`${s.value} ${s.label}`}
          >
            <Text className="font-serif-semibold text-base leading-tight text-foreground">
              {s.value}
            </Text>
            <Text
              className="mt-0.5 text-[8px] uppercase tracking-wider text-muted-foreground"
              numberOfLines={1}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View className="mt-4 flex-row gap-2">
      {stats.map((s) => (
        <Pressable
          key={s.label}
          onPress={s.onPress}
          className="flex-1 items-center rounded-xl border border-border bg-card p-2.5 active:opacity-80"
        >
          <Text className="font-serif-semibold text-lg leading-none text-foreground">
            {s.value}
          </Text>
          <Text className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
            {s.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
