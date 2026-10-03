import { useCallback, useState } from "react";
import {
  Easing,
  cancelAnimation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { HEADER_BOTTOM_RADIUS, MIN_TOOLBAR_HEIGHT, TOOLBAR_ANIM_MS, useTabBarClearance } from "@/components/CollapsibleHeader";

/** Upward scroll — show toolbar on the first frame of scroll-up. */
const SHOW_DELTA = 1;
/** Downward scroll — ignore small jitter before hiding. */
const HIDE_DELTA = 10;
const TOOLBAR_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const TOOLBAR_TIMING = {
  duration: TOOLBAR_ANIM_MS,
  easing: TOOLBAR_EASING,
} as const;

/** Ignore bottom-edge settle / load-more content growth within this band. */
const BOTTOM_EDGE_INSET = 32;

export function useCollapsibleToolbar() {
  const scrollYShared = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const lastContentHeight = useSharedValue(0);
  const toolbarTarget = useSharedValue(1);
  const [barHeight, setBarHeight] = useState(52);
  const [toolbarHeight, setToolbarHeight] = useState(72);
  const toolbarProgress = useSharedValue(1);
  const tabBarClearance = useTabBarClearance();

  const showToolbarOnUiThread = (visible: boolean) => {
    "worklet";
    const next = visible ? 1 : 0;
    if (toolbarTarget.value === next) return;
    toolbarTarget.value = next;
    cancelAnimation(toolbarProgress);
    toolbarProgress.value = withTiming(next, TOOLBAR_TIMING);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const contentHeight = event.contentSize.height;
      const layoutHeight = event.layoutMeasurement.height;
      const maxY = Math.max(0, contentHeight - layoutHeight);
      const delta = y - lastScrollY.value;
      const contentGrew = contentHeight > lastContentHeight.value + 1;
      lastScrollY.value = y;
      lastContentHeight.value = contentHeight;
      scrollYShared.value = y;

      const nearBottom = maxY > 0 && y >= maxY - BOTTOM_EDGE_INSET;

      if (y <= 8) {
        showToolbarOnUiThread(true);
        return;
      }

      if (delta < -SHOW_DELTA && !nearBottom && !contentGrew) {
        showToolbarOnUiThread(true);
        return;
      }

      if (delta > HIDE_DELTA) {
        showToolbarOnUiThread(false);
      }
    },
  });

  const handleScrollBeginDrag = useCallback(() => {
    // Scroll direction is handled in scrollHandler only.
  }, []);

  const handleScrollEndDrag = useCallback(() => {
    // Do not restore toolbar on scroll stop — only on upward scroll.
  }, []);

  const handleMomentumScrollEnd = useCallback(() => {
    // Do not restore toolbar when momentum ends.
  }, []);

  const handleHeightsChange = useCallback(
    ({ barHeight: bar, toolbarHeight: tool }: { barHeight: number; toolbarHeight: number }) => {
      setBarHeight(bar);
      if (tool < MIN_TOOLBAR_HEIGHT) return;
      setToolbarHeight(tool);
    },
    [],
  );

  const resetToolbar = useCallback(() => {
    lastScrollY.value = scrollYShared.value;
    lastContentHeight.value = 0;
    toolbarTarget.value = 1;
    cancelAnimation(toolbarProgress);
    toolbarProgress.value = 1;
  }, [lastContentHeight, lastScrollY, scrollYShared, toolbarProgress, toolbarTarget]);

  const contentContainerStyle = {
    paddingTop: barHeight + toolbarHeight + 8,
    paddingBottom: tabBarClearance,
  } as const;

  const contentShiftStyle = useAnimatedStyle(() => {
    const hidden = 1 - toolbarProgress.value;
    return {
      transform: [{ translateY: -hidden * toolbarHeight }],
    };
  }, [toolbarHeight]);

  /** Absolute-positioned lists (FlatList) — expand into toolbar space without a bottom gap. */
  const listFrameStyle = useAnimatedStyle(
    () => ({
      top:
        barHeight +
        toolbarProgress.value * toolbarHeight -
        HEADER_BOTTOM_RADIUS,
    }),
    [barHeight, toolbarHeight],
  );

  const animatedContentPaddingStyle = useAnimatedStyle(() => {
    const hidden = 1 - toolbarProgress.value;
    return {
      paddingTop: barHeight + toolbarHeight + 8 - hidden * toolbarHeight,
      paddingBottom: tabBarClearance,
    };
  }, [barHeight, toolbarHeight, tabBarClearance]);

  return {
    scrollYShared,
    toolbarProgress,
    barHeight,
    toolbarHeight,
    tabBarClearance,
    handleHeightsChange,
    scrollHandler,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleMomentumScrollEnd,
    resetToolbar,
    contentContainerStyle,
    contentShiftStyle,
    listFrameStyle,
    animatedContentPaddingStyle,
  };
}
