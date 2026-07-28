import { useCallback, useEffect, useRef, useState } from "react";
import { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useTabBarClearance, TOOLBAR_ANIM_MS } from "@/components/CollapsibleHeader";

const SCROLL_DELTA = 10;
const MOMENTUM_VELOCITY = 0.05;
const TOOLBAR_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export function useCollapsibleToolbar() {
  const scrollY = useRef(0);
  const lastY = useRef(0);
  const dragging = useRef(false);
  const momentum = useRef(false);
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

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const delta = y - lastY.current;
      lastY.current = y;
      scrollY.current = y;

      if (y <= 8 || delta < -SCROLL_DELTA) {
        showToolbar();
        return;
      }

      if (delta > SCROLL_DELTA && (dragging.current || momentum.current)) {
        hideToolbar();
      }
    },
    [hideToolbar, showToolbar],
  );

  const handleScrollBeginDrag = useCallback(() => {
    dragging.current = true;
    momentum.current = false;
  }, []);

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      dragging.current = false;
      const velocityY = event.nativeEvent.velocity?.y ?? 0;
      momentum.current = Math.abs(velocityY) >= MOMENTUM_VELOCITY;

      if (!momentum.current) {
        showToolbar();
      }
    },
    [showToolbar],
  );

  const handleMomentumScrollEnd = useCallback(() => {
    momentum.current = false;
    showToolbar();
  }, [showToolbar]);

  const handleHeightsChange = useCallback(
    ({ barHeight: bar, toolbarHeight: tool }: { barHeight: number; toolbarHeight: number }) => {
      setBarHeight(bar);
      if (tool < 48) return;
      setToolbarHeight(tool);
    },
    [],
  );

  const resetToolbar = useCallback(() => {
    lastY.current = scrollY.current;
    dragging.current = false;
    momentum.current = false;
    toolbarVisibleRef.current = true;
    setToolbarVisible(true);
    cancelAnimation(toolbarProgress);
    toolbarProgress.value = 1;
  }, [toolbarProgress]);

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
  const listFrameStyle = useAnimatedStyle(() => ({
    top: barHeight + toolbarProgress.value * toolbarHeight,
  }), [barHeight, toolbarHeight]);

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
    handleScroll,
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
