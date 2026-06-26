import { Text, View } from "react-native";
import type { Rarity } from "@/types";

const STYLES: Record<Rarity, { box: string; text: string }> = {
  common: { box: "bg-green-950 border-green-800/50", text: "text-green-400" },
  uncommon: { box: "bg-amber-950 border-amber-800/50", text: "text-amber-400" },
  rare: { box: "bg-purple-950 border-purple-800/50", text: "text-purple-400" },
};

const FALLBACK_STYLE = STYLES.common;

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const s = STYLES[rarity] ?? FALLBACK_STYLE;
  return (
    <View className={`self-start rounded border px-1.5 py-0.5 ${s.box}`}>
      <Text className={`font-mono text-[9px] uppercase tracking-widest ${s.text}`}>
        {rarity}
      </Text>
    </View>
  );
}
