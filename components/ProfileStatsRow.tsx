import { Pressable, Text, View } from "react-native";

export interface ProfileStat {
  label: string;
  value: number;
  onPress: () => void;
}

interface ProfileStatsRowProps {
  stats: ProfileStat[];
}

export function ProfileStatsRow({ stats }: ProfileStatsRowProps) {
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
