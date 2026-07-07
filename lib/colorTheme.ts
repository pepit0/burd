export type AppColorMode = "default" | "colorblind";

export interface AppPalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
}

const DEFAULT_PALETTE: AppPalette = {
  background: "#181e16",
  foreground: "#eee8d4",
  card: "#1f2a1c",
  cardForeground: "#eee8d4",
  popover: "#1f2a1c",
  primary: "#5f9470",
  primaryForeground: "#f0ead6",
  secondary: "#2a3826",
  secondaryForeground: "#eee8d4",
  muted: "#243020",
  mutedForeground: "#8a9e82",
  accent: "#c8893a",
  accentForeground: "#181e16",
  destructive: "#c0392b",
  border: "#2f3a2b",
};

// Blue/orange palette designed to avoid red-green confusion.
const COLORBLIND_PALETTE: AppPalette = {
  background: "#151a20",
  foreground: "#edf3ff",
  card: "#1d2430",
  cardForeground: "#edf3ff",
  popover: "#1d2430",
  primary: "#2f80ed",
  primaryForeground: "#f7fbff",
  secondary: "#273246",
  secondaryForeground: "#edf3ff",
  muted: "#223043",
  mutedForeground: "#a9bbd3",
  accent: "#f2994a",
  accentForeground: "#151a20",
  destructive: "#c44536",
  border: "#324457",
};

function hexToRgbTriplet(hex: string): string {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `${r} ${g} ${b}`;
}

export function paletteForMode(mode: AppColorMode): AppPalette {
  return mode === "colorblind" ? COLORBLIND_PALETTE : DEFAULT_PALETTE;
}

export function nativewindColorVars(palette: AppPalette): Record<string, string> {
  return {
    "--color-background": hexToRgbTriplet(palette.background),
    "--color-foreground": hexToRgbTriplet(palette.foreground),
    "--color-card": hexToRgbTriplet(palette.card),
    "--color-card-foreground": hexToRgbTriplet(palette.cardForeground),
    "--color-popover": hexToRgbTriplet(palette.popover),
    "--color-primary": hexToRgbTriplet(palette.primary),
    "--color-primary-foreground": hexToRgbTriplet(palette.primaryForeground),
    "--color-secondary": hexToRgbTriplet(palette.secondary),
    "--color-secondary-foreground": hexToRgbTriplet(palette.secondaryForeground),
    "--color-muted": hexToRgbTriplet(palette.muted),
    "--color-muted-foreground": hexToRgbTriplet(palette.mutedForeground),
    "--color-accent": hexToRgbTriplet(palette.accent),
    "--color-accent-foreground": hexToRgbTriplet(palette.accentForeground),
    "--color-destructive": hexToRgbTriplet(palette.destructive),
    "--color-border": hexToRgbTriplet(palette.border),
  };
}

