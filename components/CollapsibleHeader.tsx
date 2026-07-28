import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";

export const DEFAULT_TAB_HEADER_HEIGHT = 110;
export const TOOLBAR_ANIM_MS = 260;
/** Space above list content where pull-to-refresh spinner appears. */
export const REFRESH_GAP = 8;
const MIN_TOOLBAR_HEIGHT = 48;

interface TabHeaderProps {
  children: ReactNode;
  onHeightChange?: (height: number) => void;
}

/** Fixed header with safe-area inset (no scroll animation). */
export function FixedTabHeader({ children, onHeightChange }: TabHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute left-0 right-0 top-0 z-20 bg-background/95"
      style={{ paddingTop: insets.top }}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      {children}
    </View>
  );
}

interface HomeSplitHeaderProps {
  title: string;
  showLogo?: boolean;
  headerAction?: ReactNode;
  toolbar?: ReactNode;
  toolbarProgress: SharedValue<number>;
  toolbarVisible: boolean;
  onHeightsChange?: (heights: {
    barHeight: number;
    toolbarHeight: number;
  }) => void;
}

/** Home — title row fixed; search + tabs slide away on scroll down. */
export function HomeSplitHeader({
  title,
  showLogo = false,
  headerAction,
  toolbar,
  toolbarProgress,
  toolbarVisible,
  onHeightsChange,
}: HomeSplitHeaderProps) {
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(52);
  const [toolbarHeight, setToolbarHeight] = useState(72);
  const toolbarHeightRef = useRef(72);

  const handleToolbarLayout = useCallback((height: number) => {
    if (height < MIN_TOOLBAR_HEIGHT) return;
    toolbarHeightRef.current = height;
    setToolbarHeight((prev) => (prev === height ? prev : height));
  }, []);

  useEffect(() => {
    if (toolbarHeight < MIN_TOOLBAR_HEIGHT) return;
    onHeightsChange?.({ barHeight, toolbarHeight });
  }, [barHeight, toolbarHeight, onHeightsChange]);

  const resolvedToolbarHeight = Math.max(toolbarHeight, toolbarHeightRef.current);

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toolbarProgress.value,
    height: toolbarProgress.value * resolvedToolbarHeight,
  }), [resolvedToolbarHeight]);

  return (
    <>
      <View
        className="absolute left-0 right-0 top-0 z-30 bg-background"
        style={{ paddingTop: insets.top }}
        onLayout={(event) => {
          setBarHeight(event.nativeEvent.layout.height);
        }}
      >
        <ScreenHeader title={title} showLogo={showLogo} action={headerAction} />
      </View>

      {toolbar ? (
        <Animated.View
          pointerEvents={toolbarVisible ? "box-none" : "none"}
          className="absolute left-0 right-0 z-20 overflow-hidden bg-background"
          style={[
            { top: barHeight, left: 0, right: 0 },
            toolbarAnimatedStyle,
          ]}
        >
          <View
            className="pb-4 pt-1"
            onLayout={(event) => handleToolbarLayout(event.nativeEvent.layout.height)}
          >
            {toolbar}
          </View>
        </Animated.View>
      ) : null}
    </>
  );
}

/** Bottom inset clearance for floating tab bar + home indicator. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + 112;
}
