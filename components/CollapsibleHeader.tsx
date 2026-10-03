import type { ReactElement, ReactNode } from "react";
import { cloneElement, useCallback, useEffect, useState } from "react";
import { View, type RefreshControlProps } from "react-native";
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
/**
 * Rounded bottom corners for sticky headers. Scroll frames start this far
 * behind the header so content tucks under the corners while scrolling.
 */
export const HEADER_BOTTOM_RADIUS = 40;
/**
 * Floor for trusting a toolbar layout measurement. The bare toolbar shell
 * (`pt-1 pb-4`) is 20px, so anything at or below 24 is an empty/invalid
 * layout and the previous height is kept. Real toolbars can be shorter than
 * a standard 48px bar — e.g. the field guide's tab-row-only toolbar (~46px)
 * on the Collection/Explore/My Pet tabs.
 */
export const MIN_TOOLBAR_HEIGHT = 24;

/**
 * Scroll frames tuck HEADER_BOTTOM_RADIUS behind the opaque header so content
 * scrolls under the rounded bottom corners — which also hides the top-anchored
 * pull-to-refresh spinner behind the header. Offset the spinner by the same
 * tuck so it renders just below the header edge instead.
 */
export function anchorRefreshControl(
  control: ReactElement<RefreshControlProps>,
): ReactElement<RefreshControlProps> {
  return cloneElement(control, {
    progressViewOffset: control.props.progressViewOffset ?? HEADER_BOTTOM_RADIUS,
  });
}

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
      style={{
        paddingTop: insets.top,
        borderBottomLeftRadius: HEADER_BOTTOM_RADIUS,
        borderBottomRightRadius: HEADER_BOTTOM_RADIUS,
      }}
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
  onHeightsChange,
}: HomeSplitHeaderProps) {
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(52);
  const [toolbarHeight, setToolbarHeight] = useState(72);

  const handleToolbarLayout = useCallback((height: number) => {
    if (height < MIN_TOOLBAR_HEIGHT) return;
    setToolbarHeight(height);
  }, []);

  useEffect(() => {
    if (toolbarHeight < MIN_TOOLBAR_HEIGHT) return;
    onHeightsChange?.({ barHeight, toolbarHeight });
  }, [barHeight, toolbarHeight, onHeightsChange]);

  const toolbarAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: toolbarProgress.value,
      height: toolbarProgress.value * toolbarHeight,
    }),
    [toolbarHeight],
  );

  return (
    <>
      <View
        className="absolute left-0 right-0 top-0 z-30 bg-background"
        style={{
          paddingTop: insets.top,
          borderBottomLeftRadius: HEADER_BOTTOM_RADIUS,
          borderBottomRightRadius: HEADER_BOTTOM_RADIUS,
        }}
        onLayout={(event) => {
          setBarHeight(event.nativeEvent.layout.height);
        }}
      >
        <ScreenHeader title={title} showLogo={showLogo} action={headerAction} />
      </View>

      {toolbar ? (
        <Animated.View
          pointerEvents="box-none"
          className="absolute left-0 right-0 z-20 overflow-hidden bg-background"
          style={[
            {
              top: barHeight,
              left: 0,
              right: 0,
              borderBottomLeftRadius: HEADER_BOTTOM_RADIUS,
              borderBottomRightRadius: HEADER_BOTTOM_RADIUS,
            },
            toolbarAnimatedStyle,
          ]}
        >
          {/* Absolute so collapse animation clips instead of squishing children. */}
          <View className="absolute left-0 right-0 top-0">
            <View
              className="pb-4 pt-1"
              onLayout={(event) => handleToolbarLayout(event.nativeEvent.layout.height)}
            >
              {toolbar}
            </View>
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
