import { StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from "react-native";

/** 8-direction offsets — black copies peek out around the opaque fill as a letter stroke. */
const STROKE_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

/** Gentle depth on the fill — tight radius + slight drop avoids a boxy halo. */
const FOREGROUND_SOFT_SHADOW = {
  textShadowColor: "rgba(0,0,0,0.5)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
};

function inferStrokeWidth(className?: string): number {
  if (!className) return 1.23;
  if (/text-\[10px\]/.test(className)) return 0.86;
  if (/\btext-xs\b/.test(className)) return 0.98;
  if (/\btext-sm\b/.test(className)) return 1.1;
  if (/\btext-2xl\b/.test(className)) return 1.53;
  if (/\btext-xl\b/.test(className)) return 1.41;
  return 1.23;
}

/** Scrim behind bottom-aligned labels on photos. */
export const IMAGE_OVERLAY_GRADIENT = [
  "transparent",
  "rgba(24,30,22,0.45)",
  "rgba(24,30,22,0.82)",
  "rgba(24,30,22,0.98)",
] as const;

export const IMAGE_OVERLAY_BADGE_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.9,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 5,
};

interface ImageOverlayTextProps extends TextProps {
  containerStyle?: StyleProp<ViewStyle>;
  containerClassName?: string;
}

export function ImageOverlayText({
  style,
  className,
  children,
  containerStyle,
  containerClassName,
  numberOfLines,
  ...rest
}: ImageOverlayTextProps) {
  const flatStyle = StyleSheet.flatten(style);
  const stroke = inferStrokeWidth(className);
  const haloLayout = { position: "absolute" as const, left: 0, top: 0, right: 0 };

  return (
    <View
      style={[{ alignSelf: "flex-start" }, containerStyle]}
      className={containerClassName}
    >
      {STROKE_OFFSETS.map(([dx, dy], index) => (
        <Text
          key={index}
          pointerEvents="none"
          numberOfLines={numberOfLines}
          className={className}
          style={[
            flatStyle,
            haloLayout,
            {
              color: "#000",
              transform: [{ translateX: dx * stroke }, { translateY: dy * stroke }],
            },
          ]}
        >
          {children}
        </Text>
      ))}
      <Text
        className={className}
        style={[FOREGROUND_SOFT_SHADOW, style]}
        numberOfLines={numberOfLines}
        {...rest}
      >
        {children}
      </Text>
    </View>
  );
}
