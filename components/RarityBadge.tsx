import { Text, View } from "react-native";
import type { Rarity } from "@/types";

const STYLES: Record<Rarity, { box: string; text: string }> = {
  common: { box: "bg-green-950 border-green-800/50", text: "text-green-400" },
  uncommon: { box: "bg-amber-950 border-amber-800/50", text: "text-amber-400" },
  rare: { box: "bg-purple-950 border-purple-800/50", text: "text-purple-400" },
};

const FALLBACK_STYLE = STYLES.common;

const SIZE_STYLES = {
  sm: { box: "rounded border px-1.5 py-0.5", text: "text-[9px]" },
  lg: { box: "rounded-md border-2 px-3 py-1.5", text: "text-xs" },
} as const;

export function RarityBadge({
  rarity,
  size = "sm",
}: {
  rarity: Rarity;
  size?: keyof typeof SIZE_STYLES;
}) {
  const s = STYLES[rarity] ?? FALLBACK_STYLE;
  const sizing = SIZE_STYLES[size];
  return (
    <View className={`self-start ${sizing.box} ${s.box}`}>
      <Text className={`font-mono uppercase tracking-widest ${sizing.text} ${s.text}`}>
        {rarity}
      </Text>
    </View>
  );
}
