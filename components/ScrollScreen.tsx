import { useCallback, useRef, useState, type ReactNode, type RefObject } from "react";
import { ScrollView, View, type RefreshControlProps } from "react-native";
import Animated from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  DismissKeyboardArea,
  dismissKeyboardOnScrollDrag,
  keyboardAwareScrollProps,
} from "@/components/DismissKeyboard";
import {
  DEFAULT_TAB_HEADER_HEIGHT,
  FixedTabHeader,
  HomeSplitHeader,
  REFRESH_GAP,
} from "@/components/CollapsibleHeader";
import { useCollapsibleToolbar } from "@/hooks/useCollapsibleToolbar";

interface ScrollScreenProps {
  title: string;
  showLogo?: boolean;
  headerAction?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentClassName?: string;
  /** Collapsible toolbar — hides on scroll down, returns on stop or scroll up. */
  hideHeaderOnScroll?: boolean;
}

/** Tab screen shell with optional collapsible toolbar. */
export function ScrollScreen({
  title,
  showLogo = false,
  headerAction,
  toolbar,
  children,
  refreshControl,
  contentClassName = "px-4 pt-2 gap-6",
  hideHeaderOnScroll = false,
}: ScrollScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_TAB_HEADER_HEIGHT);
  const {
    scrollY,
    toolbarProgress,
    toolbarVisible,
    handleHeightsChange,
    handleScroll,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleMomentumScrollEnd,
    resetToolbar,
    listFrameStyle,
    tabBarClearance,
  } = useCollapsibleToolbar();

  const handleToolbarHeights = useCallback(
    ({ barHeight: bar, toolbarHeight: tool }: { barHeight: number; toolbarHeight: number }) => {
      handleHeightsChange({ barHeight: bar, toolbarHeight: tool });
      if (tool >= 48) {
        setHeaderHeight(bar + tool);
      }
    },
    [handleHeightsChange],
  );

  useFocusEffect(
    useCallback(() => {
      if (!hideHeaderOnScroll) return;
      resetToolbar();
      if (scrollY.current < 0) {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        scrollY.current = 0;
      }
    }, [hideHeaderOnScroll, resetToolbar, scrollY]),
  );

  const scrollContentStyle = {
    flexGrow: 1,
    paddingTop: REFRESH_GAP,
    paddingBottom: tabBarClearance,
  } as const;

  const staticHeader = (
    <>
      <ScreenHeader title={title} showLogo={showLogo} action={headerAction} />
      {toolbar ? <View className="pb-4 pt-1">{toolbar}</View> : null}
    </>
  );

  if (hideHeaderOnScroll && toolbar) {
    return (
      <View className="flex-1 bg-background">
        <HomeSplitHeader
          title={title}
          showLogo={showLogo}
          headerAction={headerAction}
          toolbar={toolbar}
          toolbarProgress={toolbarProgress}
          toolbarVisible={toolbarVisible}
          onHeightsChange={handleToolbarHeights}
        />
        <Animated.View
          style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, listFrameStyle]}
        >
          <Animated.ScrollView
            ref={scrollRef as RefObject<Animated.ScrollView>}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            decelerationRate="normal"
            onScroll={handleScroll}
            onScrollBeginDrag={() => {
              dismissKeyboardOnScrollDrag();
              handleScrollBeginDrag();
            }}
            onScrollEndDrag={handleScrollEndDrag}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            contentContainerStyle={scrollContentStyle}
            refreshControl={refreshControl}
            {...keyboardAwareScrollProps}
          >
            <DismissKeyboardArea>
              <View className={contentClassName}>{children}</View>
            </DismissKeyboardArea>
          </Animated.ScrollView>
        </Animated.View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <FixedTabHeader onHeightChange={setHeaderHeight}>{staticHeader}</FixedTabHeader>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        style={{ marginTop: headerHeight }}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        onScrollBeginDrag={dismissKeyboardOnScrollDrag}
        {...keyboardAwareScrollProps}
      >
        <DismissKeyboardArea>
          <View className={contentClassName}>{children}</View>
        </DismissKeyboardArea>
      </ScrollView>
    </View>
  );
}
