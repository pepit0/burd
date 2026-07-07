import { useMemo } from "react";
import { Text, View } from "react-native";
import { EXPLORE_CHART_ABSOLUTE_MAX } from "@/lib/exploreChecklist";
import type { MonthlyAbundance } from "@/lib/regionalFrequency";

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

interface SpeciesAbundanceChartProps {
  monthly: MonthlyAbundance[];
  currentMonth?: number;
  compact?: boolean;
  height?: number;
  /** Fixed max frequency for bar height (Merlin-style absolute scale). */
  absoluteMax?: number;
}

export function SpeciesAbundanceChart({
  monthly,
  currentMonth = new Date().getMonth() + 1,
  compact = false,
  height = compact ? 56 : 72,
  absoluteMax = EXPLORE_CHART_ABSOLUTE_MAX,
}: SpeciesAbundanceChartProps) {
  const scaleMax = Math.max(absoluteMax, 0.001);

  const hasAnySignal = useMemo(
    () => monthly.some((entry) => entry.frequency > 0),
    [monthly],
  );

  if (monthly.length === 0 || !hasAnySignal) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="font-sans text-[10px] text-muted-foreground">Not expected</Text>
      </View>
    );
  }

  const chartHeight = height - (compact ? 14 : 18);

  return (
    <View className="flex-1 justify-end" style={{ height }}>
      <View
        className="flex-row items-end gap-0.5"
        style={{ height: chartHeight }}
      >
        {monthly.map((entry) => {
          const isCurrent = entry.month === currentMonth;
          const ratio = Math.min(1, entry.frequency / scaleMax);
          const barHeight = Math.max(
            entry.frequency > 0 ? 3 : 1,
            Math.round(ratio * (chartHeight - 4)),
          );

          return (
            <View key={entry.month} className="flex-1 items-center justify-end">
              <View
                className={`w-full rounded-sm ${
                  isCurrent
                    ? "bg-accent"
                    : entry.frequency > 0
                      ? "bg-primary/70"
                      : "bg-muted-foreground/20"
                }`}
                style={{ height: barHeight }}
              />
            </View>
          );
        })}
      </View>
      <View className="mt-1 flex-row gap-0.5">
        {monthly.map((entry) => {
          const isCurrent = entry.month === currentMonth;
          return (
            <Text
              key={`label-${entry.month}`}
              className={`flex-1 text-center font-mono text-[8px] ${
                isCurrent ? "text-accent" : "text-muted-foreground/70"
              }`}
            >
              {MONTH_LABELS[entry.month - 1]}
            </Text>
          );
        })}
      </View>
    </View>
  );
}
