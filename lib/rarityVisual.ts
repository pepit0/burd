import type { Rarity } from "@/types";

export const RARITY_BORDER_COLORS: Record<Rarity, string> = {
  common: "#4ade80",
  uncommon: "#fbbf24",
  rare: "#c084fc",
};

export const RARITY_BADGE_STYLES: Record<
  Rarity,
  { box: string; text: string }
> = {
  common: { box: "bg-green-950 border-green-800/50", text: "text-green-400" },
  uncommon: { box: "bg-amber-950 border-amber-800/50", text: "text-amber-400" },
  rare: { box: "bg-purple-950 border-purple-800/50", text: "text-purple-400" },
};

export const RARITY_BADGE_SIZE = {
  sm: { box: "rounded border px-1.5 py-0.5", text: "text-[9px]" },
  lg: { box: "rounded-md border-2 px-3 py-1.5", text: "text-xs" },
} as const;
