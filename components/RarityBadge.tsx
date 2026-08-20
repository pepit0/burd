import { Text, View } from "react-native";
import type { Rarity } from "@/types";
import { isSpeciesRarityVisible } from "@/lib/rarity";
import {
  RARITY_BADGE_BOX,
  RARITY_BADGE_COLORS,
  RARITY_BADGE_TEXT,
} from "@/lib/rarityVisual";

const FALLBACK_COLORS = RARITY_BADGE_COLORS.common;

export function RarityBadge({
  rarity,
  size = "sm",
  alwaysShow = false,
  variant = "boxed",
}: {
  rarity: Rarity;
  size?: "sm" | "lg";
  alwaysShow?: boolean;
  variant?: "boxed" | "plain";
}) {
  if (!alwaysShow && !isSpeciesRarityVisible()) return null;

  const colors = RARITY_BADGE_COLORS[rarity] ?? FALLBACK_COLORS;
  const textStyle = [RARITY_BADGE_TEXT[size], { color: colors.text }];

  if (variant === "plain") {
    return (
      <Text
        style={[
          ...textStyle,
          {
            textShadowColor: "rgba(0, 0, 0, 0.85)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          },
        ]}
      >
        {rarity}
      </Text>
    );
  }

  return (
    <View
      style={[
        RARITY_BADGE_BOX[size],
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      <Text style={textStyle}>{rarity}</Text>
    </View>
  );
}
