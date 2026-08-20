import { Pressable, Text, View } from "react-native";

export interface ProfileStat {
  label: string;
  value: number;
  onPress?: () => void;
}

interface ProfileStatsRowProps {
  stats: ProfileStat[];
  variant?: "boxed" | "inline";
}

function StatCell({
  stat,
  className,
  variant,
}: {
  stat: ProfileStat;
  className: string;
  variant: "boxed" | "inline";
}) {
  const content =
    variant === "inline" ? (
      <>
        <Text className="font-serif-semibold text-base leading-tight text-foreground">
          {stat.value}
        </Text>
        <Text
          className="mt-0.5 text-[8px] uppercase tracking-wider text-muted-foreground"
          numberOfLines={1}
        >
          {stat.label}
        </Text>
      </>
    ) : (
      <>
        <Text className="font-serif-semibold text-lg leading-none text-foreground">
          {stat.value}
        </Text>
        <Text className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
          {stat.label}
        </Text>
      </>
    );

  if (stat.onPress) {
    return (
      <Pressable
        onPress={stat.onPress}
        className={`${className} ${variant === "inline" ? "active:opacity-70" : "active:opacity-80"}`}
        accessibilityRole="button"
        accessibilityLabel={`${stat.value} ${stat.label}`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      className={className}
      accessibilityLabel={`${stat.value} ${stat.label}`}
    >
      {content}
    </View>
  );
}

export function ProfileStatsRow({ stats, variant = "boxed" }: ProfileStatsRowProps) {
  if (variant === "inline") {
    return (
      <View className="flex-row items-center justify-end gap-3">
        {stats.map((s) => (
          <StatCell
            key={s.label}
            stat={s}
            variant="inline"
            className="h-14 w-14 items-center justify-center"
          />
        ))}
      </View>
    );
  }

  return (
    <View className="mt-4 flex-row gap-2">
      {stats.map((s) => (
        <StatCell
          key={s.label}
          stat={s}
          variant="boxed"
          className="flex-1 items-center rounded-xl border border-border bg-card p-2.5"
        />
      ))}
    </View>
  );
}
