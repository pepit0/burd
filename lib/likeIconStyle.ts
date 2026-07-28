export const LIKE_ICON_STYLES = [
  { id: "heart", label: "Heart" },
  { id: "thumbs_up", label: "Thumbs up" },
  { id: "bird", label: "Bird" },
  { id: "burd", label: "Burd logo" },
  { id: "leaf", label: "Leaf" },
] as const;

export type LikeIconStyle = (typeof LIKE_ICON_STYLES)[number]["id"];

export const DEFAULT_LIKE_ICON_STYLE: LikeIconStyle = "heart";

export const LIKED_ICON_COLOR = "#f87171";
export const INACTIVE_ICON_COLOR = "#8a9e82";
export const INACTIVE_ICON_COLOR_ON_DARK = "#eee8d4";

export function normalizeLikeIconStyle(value: string | null | undefined): LikeIconStyle {
  if (value && LIKE_ICON_STYLES.some((option) => option.id === value)) {
    return value as LikeIconStyle;
  }
  return DEFAULT_LIKE_ICON_STYLE;
}
