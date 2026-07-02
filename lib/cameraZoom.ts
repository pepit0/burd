import { Platform } from "react-native";

export const DEFAULT_MAX_ZOOM_FACTOR = 10;

export interface ZoomCapabilities {
  /** Widest angle label (1× = default wide; ultrawide needs discrete lens — we skip it for smooth zoom). */
  minLabel: number;
  /** Max magnification label for this device. */
  maxLabel: number;
}

export function formatZoomFactor(factor: number): string {
  const rounded = Math.round(factor * 10) / 10;
  const text =
    rounded < 10
      ? rounded.toFixed(1).replace(/\.0$/, "")
      : String(Math.round(rounded));
  return `${text}×`;
}

function hasLensRole(lenses: unknown[], role: "ultra" | "tele"): boolean {
  for (const entry of lenses) {
    const name =
      typeof entry === "string"
        ? entry
        : `${(entry as { deviceType?: string }).deviceType ?? ""} ${(entry as { localizedName?: string }).localizedName ?? ""}`;
    const lower = name.toLowerCase();
    if (role === "ultra") {
      if (
        lower.includes("ultra") ||
        lower.includes("0.5") ||
        lower.includes("builtInultrawide")
      ) {
        return true;
      }
    }
    if (role === "tele") {
      if (lower.includes("tele") || lower.includes("builtintelephoto")) {
        return true;
      }
    }
  }
  return false;
}

/** Infer display range from available lenses — camera uses system default (no selectedLens). */
export function capabilitiesFromLenses(lensesInput: unknown[]): ZoomCapabilities {
  const hasTele = hasLensRole(lensesInput, "tele");
  return {
    minLabel: 1,
    maxLabel: hasTele ? 15 : DEFAULT_MAX_ZOOM_FACTOR,
  };
}

export function defaultCapabilities(): ZoomCapabilities {
  if (Platform.OS === "web") {
    return { minLabel: 1, maxLabel: 3 };
  }
  return { minLabel: 1, maxLabel: DEFAULT_MAX_ZOOM_FACTOR };
}

export function frontCameraCapabilities(): ZoomCapabilities {
  return { minLabel: 1, maxLabel: 2 };
}

/** expo `zoom` prop 0–1 → approximate magnification label. */
export function labelFromZoomProp(
  zoom: number,
  caps: ZoomCapabilities,
): string {
  const clamped = Math.max(0, Math.min(1, zoom));
  const factor =
    caps.minLabel *
    Math.pow(caps.maxLabel / caps.minLabel, clamped);
  return formatZoomFactor(factor);
}

/** Magnification label → expo `zoom` prop 0–1. */
export function zoomPropFromLabel(
  factor: number,
  caps: ZoomCapabilities,
): number {
  const clamped = Math.max(
    caps.minLabel,
    Math.min(caps.maxLabel, factor),
  );
  if (clamped <= caps.minLabel) return 0;
  const span = Math.log(caps.maxLabel / caps.minLabel);
  if (span <= 0) return 0;
  return Math.min(1, Math.log(clamped / caps.minLabel) / span);
}

export function clampZoomProp(zoom: number): number {
  return Math.max(0, Math.min(1, zoom));
}

export function magnificationFromZoomProp(
  zoom: number,
  caps: ZoomCapabilities,
): number {
  const clamped = clampZoomProp(zoom);
  return (
    caps.minLabel *
    Math.pow(caps.maxLabel / caps.minLabel, clamped)
  );
}
