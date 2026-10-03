import type { TextStyle, ViewStyle } from "react-native";
import type { Rarity } from "@/types";

export const RARITY_BORDER_COLORS: Record<Rarity, string> = {
  common: "#4ade80",
  uncommon: "#fbbf24",
  rare: "#c084fc",
};

/** Explicit colors — avoid Tailwind classes from lib/ (not in content scan). */
export const RARITY_BADGE_COLORS: Record<
  Rarity,
  { bg: string; border: string; text: string }
> = {
  common: {
    bg: "#052e16",
    border: "rgba(22, 101, 52, 0.5)",
    text: "#4ade80",
  },
  uncommon: {
    bg: "#451a03",
    border: "rgba(146, 64, 14, 0.5)",
    text: "#fbbf24",
  },
  rare: {
    bg: "#3b0764",
    border: "rgba(107, 33, 168, 0.5)",
    text: "#c084fc",
  },
};

export const RARITY_BADGE_BOX: Record<"sm" | "lg", ViewStyle> = {
  sm: {
    alignSelf: "flex-start",
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lg: {
    alignSelf: "flex-start",
    borderRadius: 6,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
};

export const RARITY_BADGE_TEXT: Record<"sm" | "lg", TextStyle> = {
  sm: {
    fontFamily: "DMSans_400Regular",
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  lg: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
};

/**
 * Border-only accent per rarity — journal cards use the neutral bg-card surface.
 * One shade deeper than the badge colors at 60% opacity so the outline settles
 * into the forest-green theme instead of glowing against it.
 */
export const JOURNAL_CARD_RARITY_STYLE: Record<Rarity, ViewStyle> = {
  common: {
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.6)",
  },
  uncommon: {
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.6)",
  },
  rare: {
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.6)",
  },
};
