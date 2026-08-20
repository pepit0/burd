import { Text, View } from "react-native";
import type { Rarity } from "@/types";
import { isSpeciesRarityVisible } from "@/lib/rarity";
import {
  RARITY_BADGE_SIZE,
  RARITY_BADGE_STYLES,
} from "@/lib/rarityVisual";

const FALLBACK_STYLE = RARITY_BADGE_STYLES.common;

export function RarityBadge({
  rarity,
  size = "sm",
  alwaysShow = false,
  variant = "boxed",
}: {
  rarity: Rarity;
  size?: keyof typeof RARITY_BADGE_SIZE;
  alwaysShow?: boolean;
  variant?: "boxed" | "plain";
}) {
  if (!alwaysShow && !isSpeciesRarityVisible()) return null;

  const s = RARITY_BADGE_STYLES[rarity] ?? FALLBACK_STYLE;
  const sizing = RARITY_BADGE_SIZE[size];

  if (variant === "plain") {
    return (
      <Text
        className={`font-mono uppercase tracking-widest ${sizing.text} ${s.text}`}
        style={{
          textShadowColor: "rgba(0, 0, 0, 0.85)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      >
        {rarity}
      </Text>
    );
  }

  return (
    <View className={`self-start ${sizing.box} ${s.box}`}>
      <Text className={`font-mono uppercase tracking-widest ${sizing.text} ${s.text}`}>
        {rarity}
      </Text>
    </View>
  );
}