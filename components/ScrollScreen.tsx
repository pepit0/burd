import { useCallback, useRef, useState, type ReactElement, type ReactNode, type RefObject } from "react";
import { ScrollView, View, type ListRenderItem, type RefreshControlProps } from "react-native";
import { FlatList } from "react-native-gesture-handler";
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
  HEADER_BOTTOM_RADIUS,
  HomeSplitHeader,
  REFRESH_GAP,
  anchorRefreshControl,
} from "@/components/CollapsibleHeader";
import { useCollapsibleToolbar } from "@/hooks/useCollapsibleToolbar";

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

interface ScrollScreenProps<T = unknown> {
  title: string;
  showLogo?: boolean;
  headerAction?: ReactNode;
  toolbar?: ReactNode;
  children?: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentClassName?: string;
  /** Collapsible toolbar — hides on scroll down, returns only on scroll up. */
  hideHeaderOnScroll?: boolean;
  /** Virtualized list (recommended for long feeds). */
  listData?: readonly T[];
  listKeyExtractor?: (item: T, index: number) => string;
  renderListItem?: ListRenderItem<T>;
  ListEmptyComponent?: ReactElement | null;
  listItemClassName?: string;
}

/** Tab screen shell with optional collapsible toolbar. */
export function ScrollScreen<T = unknown>({
  title,
  showLogo = false,
  headerAction,
  toolbar,
  children,
  refreshControl,
  contentClassName = "px-4 pt-2 gap-6",
  hideHeaderOnScroll = false,
  listData,
  listKeyExtractor,
  renderListItem,
  ListEmptyComponent,
  listItemClassName = "px-4 mb-6",
}: ScrollScreenProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const listRef = useRef<FlatList<T>>(null);
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_TAB_HEADER_HEIGHT);
  const {
    scrollYShared,
    toolbarProgress,
    handleHeightsChange,
    scrollHandler,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleMomentumScrollEnd,
    resetToolbar,
    listFrameStyle,
    tabBarClearance,
  } = useCollapsibleToolbar();

  const useVirtualizedList =
    hideHeaderOnScroll &&
    toolbar &&
    listData !== undefined &&
    renderListItem !== undefined &&
    listKeyExtractor !== undefined;

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
      if (scrollYShared.value < 0) {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        scrollYShared.value = 0;
      }
    }, [hideHeaderOnScroll, resetToolbar, scrollYShared]),
  );

  const renderFlatListItem = useCallback(
    (info: Parameters<NonNullable<typeof renderListItem>>[0]) => (
      <View className={listItemClassName}>{renderListItem!(info)}</View>
    ),
    [renderListItem, listItemClassName],
  );

  const scrollContentStyle = {
    flexGrow: 1,
    paddingTop: REFRESH_GAP + HEADER_BOTTOM_RADIUS,
    paddingBottom: tabBarClearance,
  } as const;

  const listContentStyle = {
    flexGrow: 1,
    paddingTop: REFRESH_GAP + HEADER_BOTTOM_RADIUS,
    paddingBottom: tabBarClearance,
  } as const;

  const staticHeader = (
    <>
      <ScreenHeader title={title} showLogo={showLogo} action={headerAction} />
      {toolbar ? <View className="pb-4 pt-1">{toolbar}</View> : null}
    </>
  );

  // Scroll frames tuck behind the header; offset the spinner so it stays visible.
  const anchoredRefreshControl = refreshControl
    ? anchorRefreshControl(refreshControl)
    : undefined;

  if (hideHeaderOnScroll && toolbar) {
    return (
      <View className="flex-1 bg-background">
        <HomeSplitHeader
          title={title}
          showLogo={showLogo}
          headerAction={headerAction}
          toolbar={toolbar}
          toolbarProgress={toolbarProgress}
          onHeightsChange={handleToolbarHeights}
        />
        <Animated.View
          style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, listFrameStyle]}
        >
          {useVirtualizedList ? (
            <AnimatedFlatList
              ref={listRef as RefObject<FlatList<T>>}
              data={listData as T[]}
              keyExtractor={listKeyExtractor}
              renderItem={renderFlatListItem}
              ListEmptyComponent={
                ListEmptyComponent ? (
                  <View className={`${listItemClassName} pt-2`}>{ListEmptyComponent}</View>
                ) : undefined
              }
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              decelerationRate="normal"
              onScroll={scrollHandler}
              onScrollBeginDrag={() => {
                dismissKeyboardOnScrollDrag();
                handleScrollBeginDrag();
              }}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              contentContainerStyle={listContentStyle}
              refreshControl={anchoredRefreshControl}
              removeClippedSubviews
              initialNumToRender={3}
              maxToRenderPerBatch={4}
              windowSize={5}
              updateCellsBatchingPeriod={50}
              {...keyboardAwareScrollProps}
            />
          ) : (
            <Animated.ScrollView
              ref={scrollRef as RefObject<Animated.ScrollView>}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              decelerationRate="normal"
              onScroll={scrollHandler}
              onScrollBeginDrag={() => {
                dismissKeyboardOnScrollDrag();
                handleScrollBeginDrag();
              }}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              contentContainerStyle={scrollContentStyle}
              refreshControl={anchoredRefreshControl}
              {...keyboardAwareScrollProps}
            >
              <DismissKeyboardArea>
                <View className={contentClassName}>{children}</View>
              </DismissKeyboardArea>
            </Animated.ScrollView>
          )}
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
        style={{ marginTop: headerHeight - HEADER_BOTTOM_RADIUS }}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={anchoredRefreshControl}
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
