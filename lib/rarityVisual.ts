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
    fontFamily: "JetBrainsMono_400Regular",
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  lg: {
    fontFamily: "JetBrainsMono_400Regular",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
};

export const JOURNAL_CARD_RARITY_STYLE: Record<Rarity, ViewStyle | undefined> = {
  common: undefined,
  uncommon: {
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.45)",
    backgroundColor: "rgba(69, 26, 3, 0.5)",
  },
  rare: {
    borderWidth: 1,
    borderColor: "rgba(107, 33, 168, 0.45)",
    backgroundColor: "rgba(59, 7, 100, 0.55)",
  },
};
