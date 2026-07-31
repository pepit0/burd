import { useCallback, useEffect, useRef, useState } from "react";
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { TOOLBAR_ANIM_MS, useTabBarClearance } from "@/components/CollapsibleHeader";

/** Upward scroll — show toolbar on the first frame of scroll-up. */
const SHOW_DELTA = 1;
/** Downward scroll — ignore small jitter before hiding. */
const HIDE_DELTA = 10;
const TOOLBAR_EASING = Easing.bezier(0.4, 0, 0.2, 1);

/** Ignore bottom-edge settle / load-more content growth within this band. */
const BOTTOM_EDGE_INSET = 32;

export function useCollapsibleToolbar() {
  const scrollY = useRef(0);
  const lastScrollY = useSharedValue(0);
  const lastContentHeight = useSharedValue(0);
  const [barHeight, setBarHeight] = useState(52);
  const [toolbarHeight, setToolbarHeight] = useState(72);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const toolbarVisibleRef = useRef(true);
  const toolbarProgress = useSharedValue(1);
  const tabBarClearance = useTabBarClearance();

  useEffect(() => {
    cancelAnimation(toolbarProgress);
    toolbarProgress.value = withTiming(toolbarVisible ? 1 : 0, {
      duration: TOOLBAR_ANIM_MS,
      easing: TOOLBAR_EASING,
    });
  }, [toolbarVisible, toolbarProgress]);

  const syncScrollY = useCallback((y: number) => {
    scrollY.current = y;
  }, []);

  const showToolbar = useCallback(() => {
    if (toolbarVisibleRef.current) return;
    toolbarVisibleRef.current = true;
    setToolbarVisible(true);
  }, []);

  const hideToolbar = useCallback(() => {
    if (!toolbarVisibleRef.current) return;
    toolbarVisibleRef.current = false;
    setToolbarVisible(false);
  }, []);

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
      runOnJS(syncScrollY)(y);

      const nearBottom = maxY > 0 && y >= maxY - BOTTOM_EDGE_INSET;

      if (y <= 8) {
        runOnJS(showToolbar)();
        return;
      }

      if (delta < -SHOW_DELTA && !nearBottom && !contentGrew) {
        runOnJS(showToolbar)();
        return;
      }

      if (delta > HIDE_DELTA) {
        runOnJS(hideToolbar)();
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
      if (tool < 48) return;
      setToolbarHeight(tool);
    },
    [],
  );

  const resetToolbar = useCallback(() => {
    lastScrollY.value = scrollY.current;
    lastContentHeight.value = 0;
    toolbarVisibleRef.current = true;
    setToolbarVisible(true);
    cancelAnimation(toolbarProgress);
    toolbarProgress.value = 1;
  }, [lastContentHeight, lastScrollY, toolbarProgress]);

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
      top: barHeight + toolbarProgress.value * toolbarHeight,
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
    scrollY,
    toolbarProgress,
    toolbarVisible,
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
