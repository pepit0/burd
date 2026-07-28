import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Profile } from "@/types";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Check, Filter, Search } from "lucide-react-native";
import { HomeSplitHeader, REFRESH_GAP, useTabBarClearance } from "@/components/CollapsibleHeader";
import {
  dismissKeyboardOnScrollDrag,
  keyboardAwareScrollProps,
} from "@/components/DismissKeyboard";
import { TabEmptyState } from "@/components/TabEmptyState";
import { FilterSheet } from "@/components/FilterSheet";
import { FieldGuideExploreTab } from "@/components/FieldGuideExploreTab";
import { useCollapsibleToolbar } from "@/hooks/useCollapsibleToolbar";
import { RarityBadge } from "@/components/RarityBadge";
import { SpeciesImage } from "@/components/SpeciesImage";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useMySightings } from "@/hooks/useMySightings";
import {
  buildSightingIndex,
  countLoggedInCatalog,
  filterCatalog,
  filterCatalogByOptions,
  sortCatalogLoggedFirst,
  toFieldGuideEntry,
  type FieldGuideEntry,
  type FieldGuideRegionalContext,
} from "@/lib/fieldGuide";
import {
  countActiveFieldGuideFilters,
  DEFAULT_FIELD_GUIDE_FILTERS,
  type FieldGuideFilters,
  type FeedRarityFilter,
  type FieldGuideLoggedFilter,
} from "@/lib/filters";
import { resetFieldGuideImageLoader, primeFieldGuideImages } from "@/lib/fieldGuideImageLoader";
import { getMyProfile } from "@/lib/sightings";
import { consumeFieldGuideIntent } from "@/lib/navigationIntent";
import { SPECIES_CATALOG } from "@/lib/speciesCatalog";

const FIELD_GUIDE_TABS = [
  { id: "guide", label: "Guide" },
  { id: "explore", label: "Explore" },
] as const;

type FieldGuideTab = (typeof FIELD_GUIDE_TABS)[number]["id"];

/** Species shown on first paint (5 rows × 2 columns). */
const INITIAL_COUNT = 10;
/** Species added each time the user reaches the bottom (3 rows). */
const LOAD_MORE_COUNT = 6;
const GUIDE_LIST_PADDING = 16;
const GUIDE_COL_GAP = 12;
const GUIDE_ROW_PADDING = 16;
const LOAD_COOLDOWN_MS = 500;

function guideCardHeight(screenWidth: number): number {
  return Math.floor(
    (screenWidth - GUIDE_LIST_PADDING * 2 - GUIDE_COL_GAP) / 2,
  );
}

function guideRowHeight(screenWidth: number): number {
  return guideCardHeight(screenWidth) + GUIDE_ROW_PADDING;
}

const OVERLAY_TEXT_SHADOW: TextStyle = {
  textShadowColor: "rgba(0,0,0,0.9)",
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 3,
};

const OVERLAY_BADGE_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.85,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 0 },
  elevation: 4,
};

interface GuideRow {
  id: string;
  left: FieldGuideEntry;
  right: FieldGuideEntry | null;
}

function entriesToRows(entries: FieldGuideEntry[]): GuideRow[] {
  const rows: GuideRow[] = [];
  for (let i = 0; i < entries.length; i += 2) {
    const left = entries[i];
    const right = entries[i + 1] ?? null;
    rows.push({
      id: right ? `${left.id}-${right.id}` : left.id,
      left,
      right,
    });
  }
  return rows;
}

interface SpeciesCardProps {
  entry: FieldGuideEntry;
  cardHeight: number;
  onPress: (id: string) => void;
}

const SpeciesCard = memo(function SpeciesCard({
  entry,
  cardHeight,
  onPress,
}: SpeciesCardProps) {
  return (
    <Pressable
      onPress={() => onPress(entry.id)}
      style={{ flex: 1, height: cardHeight }}
      className="overflow-hidden rounded-2xl border border-border bg-muted active:opacity-90"
    >
      <SpeciesImage
        catalogId={entry.id}
        scientificName={entry.scientific_name}
        gridLoader
        className="h-full w-full"
      />
      <LinearGradient
        colors={["transparent", "rgba(24,30,22,0.55)", "rgba(24,30,22,0.95)"]}
        className="absolute inset-0"
        pointerEvents="none"
      />
      {entry.logged ? (
        <View className="absolute right-2 top-2 h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check size={10} color="#f0ead6" strokeWidth={2.5} />
        </View>
      ) : null}
      <View className="absolute bottom-0 left-0 right-0 p-2.5">
        <View className="flex-row items-end justify-between gap-2">
          <Text
            className="min-w-0 flex-1 font-serif text-sm leading-tight text-foreground"
            style={OVERLAY_TEXT_SHADOW}
            numberOfLines={2}
          >
            {entry.species}
          </Text>
          <View className="shrink-0" style={OVERLAY_BADGE_SHADOW}>
            <RarityBadge rarity={entry.rarity} />
          </View>
        </View>
        <Text
          className="mt-0.5 font-serif-italic text-[10px] text-foreground/85"
          style={OVERLAY_TEXT_SHADOW}
          numberOfLines={1}
        >
          {entry.scientific_name}
        </Text>
      </View>
    </Pressable>
  );
});

interface GuideRowViewProps {
  row: GuideRow;
  cardHeight: number;
  rowHeight: number;
  onPress: (id: string) => void;
}

const GuideRowView = memo(function GuideRowView({
  row,
  cardHeight,
  rowHeight,
  onPress,
}: GuideRowViewProps) {
  return (
    <View
      style={{
        height: rowHeight,
        flexDirection: "row",
        gap: GUIDE_COL_GAP,
        paddingBottom: GUIDE_ROW_PADDING / 2,
      }}
    >
      <SpeciesCard entry={row.left} cardHeight={cardHeight} onPress={onPress} />
      {row.right ? (
        <SpeciesCard entry={row.right} cardHeight={cardHeight} onPress={onPress} />
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
});

export default function FieldGuideScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardHeight = useMemo(() => guideCardHeight(screenWidth), [screenWidth]);
  const rowHeight = useMemo(() => guideRowHeight(screenWidth), [screenWidth]);
  const { coords: guideCoords } = useCurrentLocation();
  const regionalContext = useMemo((): FieldGuideRegionalContext | null => {
    if (!guideCoords) return null;
    return { lat: guideCoords.latitude, lng: guideCoords.longitude };
  }, [guideCoords]);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const catalogUserId = viewUserId ?? userId;
  const { sightings, loading, refreshing, error, refresh, silentRefresh } =
    useMySightings(catalogUserId);
  const [search, setSearch] = useState("");
  const [sortLoggedFirst, setSortLoggedFirst] = useState(false);
  const [guideFilters, setGuideFilters] = useState<FieldGuideFilters>(
    DEFAULT_FIELD_GUIDE_FILTERS,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [tab, setTab] = useState<FieldGuideTab>("guide");
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const activeFilterCount = countActiveFieldGuideFilters(guideFilters);
  const listRef = useRef<FlatList<GuideRow>>(null);
  const tabBarClearance = useTabBarClearance();
  const {
    toolbarProgress,
    toolbarVisible,
    barHeight,
    toolbarHeight,
    handleHeightsChange,
    handleScroll,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleMomentumScrollEnd,
    resetToolbar,
    listFrameStyle,
  } = useCollapsibleToolbar();

  const staticTopInset = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    top: barHeight + toolbarHeight + 8,
    paddingBottom: tabBarClearance,
  };

  const loadingMore = useRef(false);
  const lastLoadAt = useRef(0);
  const visibleCountRef = useRef(INITIAL_COUNT);
  const filteredLengthRef = useRef(SPECIES_CATALOG.length);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      const intent = consumeFieldGuideIntent();
      if (intent) {
        setSortLoggedFirst(intent.sortLoggedFirst);
        setViewUserId(intent.userId);
        setTab("guide");
        setVisibleCount(INITIAL_COUNT);
        visibleCountRef.current = INITIAL_COUNT;
        resetFieldGuideImageLoader();
        if (intent.userId) {
          void getMyProfile(intent.userId).then(setViewProfile);
        } else {
          setViewProfile(null);
        }
      }

      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      silentRefresh();
    }, [silentRefresh]),
  );

  useFocusEffect(
    useCallback(() => {
      resetToolbar();
    }, [resetToolbar]),
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSortLoggedFirst(false);
        setViewUserId(null);
        setViewProfile(null);
      };
    }, []),
  );

  const sightingIndex = useMemo(
    () => buildSightingIndex(sightings),
    [sightings],
  );

  const filteredCatalog = useMemo(() => {
    let list = filterCatalog(SPECIES_CATALOG, search);
    list = filterCatalogByOptions(list, guideFilters, sightingIndex, regionalContext);
    if (sortLoggedFirst) {
      list = sortCatalogLoggedFirst(list, sightingIndex);
    }
    return list;
  }, [search, sortLoggedFirst, guideFilters, sightingIndex, regionalContext]);

  filteredLengthRef.current = filteredCatalog.length;
  visibleCountRef.current = visibleCount;

  const searchResetReady = useRef(false);
  const sortLoggedFirstReady = useRef(false);
  const guideFiltersReady = useRef(false);

  useEffect(() => {
    if (!searchResetReady.current) {
      searchResetReady.current = true;
      return;
    }

    setVisibleCount(INITIAL_COUNT);
    visibleCountRef.current = INITIAL_COUNT;
    loadingMore.current = false;
    lastLoadAt.current = 0;
    resetFieldGuideImageLoader();
  }, [search]);

  useEffect(() => {
    if (!sortLoggedFirstReady.current) {
      sortLoggedFirstReady.current = true;
      return;
    }

    setVisibleCount(INITIAL_COUNT);
    visibleCountRef.current = INITIAL_COUNT;
    loadingMore.current = false;
    lastLoadAt.current = 0;
    resetFieldGuideImageLoader();
  }, [sortLoggedFirst]);

  useEffect(() => {
    if (!guideFiltersReady.current) {
      guideFiltersReady.current = true;
      return;
    }

    setVisibleCount(INITIAL_COUNT);
    visibleCountRef.current = INITIAL_COUNT;
    loadingMore.current = false;
    lastLoadAt.current = 0;
    resetFieldGuideImageLoader();
  }, [guideFilters]);

  const visibleEntries = useMemo(() => {
    return filteredCatalog
      .slice(0, visibleCount)
      .map((item) => toFieldGuideEntry(item, sightingIndex, regionalContext));
  }, [filteredCatalog, visibleCount, sightingIndex, regionalContext]);

  useEffect(() => {
    primeFieldGuideImages(visibleEntries.map((entry) => entry.id));
  }, [visibleEntries]);

  const rows = useMemo(() => entriesToRows(visibleEntries), [visibleEntries]);
  const hasMore = visibleCount < filteredCatalog.length;

  const guideListContentStyle = {
    flexGrow: rows.length === 0 ? 1 : 0,
    paddingHorizontal: GUIDE_LIST_PADDING,
    paddingTop: REFRESH_GAP,
    paddingBottom: tabBarClearance,
  } as const;

  const loggedCount = useMemo(
    () => countLoggedInCatalog(SPECIES_CATALOG, sightingIndex),
    [sightingIndex],
  );
  const progress = (loggedCount / SPECIES_CATALOG.length) * 100;

  const loadMore = useCallback(() => {
    const total = filteredLengthRef.current;
    if (loadingMore.current || visibleCountRef.current >= total) return;

    const now = Date.now();
    if (now - lastLoadAt.current < LOAD_COOLDOWN_MS) return;

    loadingMore.current = true;
    lastLoadAt.current = now;

    const next = Math.min(
      visibleCountRef.current + LOAD_MORE_COUNT,
      total,
    );
    visibleCountRef.current = next;
    setVisibleCount(next);

    setTimeout(() => {
      loadingMore.current = false;
    }, LOAD_COOLDOWN_MS);
  }, []);

  const tryLoadMoreAtBottom = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;

      if (contentSize.height <= layoutMeasurement.height + 40) return;
      if (contentOffset.y < 16) return;

      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;

      if (distanceFromBottom <= 200) {
        loadMore();
      }
    },
    [loadMore],
  );

  const openSpecies = useCallback(
    (id: string) => {
      router.push(`/species/${id}`);
    },
    [router],
  );

  const renderRow = useCallback(
    ({ item }: { item: GuideRow }) => (
      <GuideRowView
        row={item}
        cardHeight={cardHeight}
        rowHeight={rowHeight}
        onPress={openSpecies}
      />
    ),
    [openSpecies, cardHeight, rowHeight],
  );

  const getRowLayout = useCallback(
    (_: ArrayLike<GuideRow> | null | undefined, index: number) => ({
      length: rowHeight,
      offset: rowHeight * index,
      index,
    }),
    [rowHeight],
  );

  const listFooter = (
    <View style={{ height: 56, alignItems: "center", justifyContent: "center" }}>
      {hasMore ? <ActivityIndicator color="#5f9470" size="small" /> : null}
    </View>
  );

  const handleListScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleMomentumScrollEnd();
      tryLoadMoreAtBottom(event);
    },
    [handleMomentumScrollEnd, tryLoadMoreAtBottom],
  );

  const handleListScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScrollEndDrag(event);
      tryLoadMoreAtBottom(event);
    },
    [handleScrollEndDrag, tryLoadMoreAtBottom],
  );

  const headerTitle = viewProfile
    ? `@${viewProfile.username}'s species`
    : "Field Guide";
  const progressLabel = viewProfile
    ? `@${viewProfile.username}'s progress`
    : "Lifetime progress";
  const loggedFilterLabel = viewProfile
    ? `Logged by @${viewProfile.username}`
    : "Logged by you";
  const showExploreTab = !viewUserId;

  const guideToolbar = (
    <>
      {showExploreTab ? (
        <View className="px-4 pb-1 pt-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="flex-row items-center gap-2 pr-2"
          >
            {FIELD_GUIDE_TABS.map((item) => {
              const active = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setTab(item.id)}
                  className={`rounded-full px-3 py-1 ${
                    active ? "bg-primary" : "border border-border bg-card"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      active
                        ? "font-sans-medium text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {tab !== "explore" ? (
        <View className="gap-3 px-4 pb-0 pt-3">
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
              <Search size={14} color="#8a9e82" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Find a species..."
                placeholderTextColor="#8a9e82"
                className="flex-1 font-sans text-sm text-foreground"
              />
            </View>
            <Pressable
              onPress={() => setFilterOpen(true)}
              className={`rounded-xl border p-2.5 active:opacity-80 ${
                activeFilterCount > 0
                  ? "border-primary bg-primary/15"
                  : "border-border bg-card"
              }`}
            >
              <Filter
                size={16}
                color={activeFilterCount > 0 ? "#5f9470" : "#8a9e82"}
              />
            </Pressable>
          </View>

          <View className="rounded-xl border border-border bg-card p-3.5">
            <View className="mb-2.5 flex-row items-center justify-between">
              <Text className="font-sans text-xs text-muted-foreground">
                {progressLabel}
              </Text>
              <Text className="font-mono text-xs text-accent">
                {loggedCount}/{SPECIES_CATALOG.length} species logged
              </Text>
            </View>
            <View className="h-1.5 overflow-hidden rounded-full bg-muted">
              <View
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </View>
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <View className="flex-1 bg-background">
      <HomeSplitHeader
        title={headerTitle}
        toolbar={guideToolbar}
        toolbarProgress={toolbarProgress}
        toolbarVisible={toolbarVisible}
        onHeightsChange={handleHeightsChange}
      />

      {tab === "explore" && showExploreTab ? (
        <FieldGuideExploreTab
          onScroll={handleScroll}
          onScrollBeginDrag={() => {
            dismissKeyboardOnScrollDrag();
            handleScrollBeginDrag();
          }}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          listFrameStyle={listFrameStyle}
          tabBarClearance={tabBarClearance}
        />
      ) : (
        <>
      {loading && sightings.length === 0 ? (
        <View style={staticTopInset}>
          <TabEmptyState loading />
        </View>
      ) : error ? (
        <View style={staticTopInset}>
          <TabEmptyState>{error}</TabEmptyState>
        </View>
      ) : (
        <Animated.View
          style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, listFrameStyle]}
        >
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderRow}
            getItemLayout={getRowLayout}
            ListFooterComponent={listFooter}
            contentContainerStyle={guideListContentStyle}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            initialNumToRender={5}
            maxToRenderPerBatch={3}
            windowSize={5}
            onScroll={handleScroll}
            onScrollBeginDrag={() => {
              dismissKeyboardOnScrollDrag();
              handleScrollBeginDrag();
            }}
            onScrollEndDrag={handleListScrollEndDrag}
            onMomentumScrollEnd={handleListScrollEnd}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor="#5f9470"
              />
            }
            {...keyboardAwareScrollProps}
            ListEmptyComponent={
              <TabEmptyState>
                {activeFilterCount > 0 || search.trim()
                  ? "No species match your search or filters."
                  : "No species to show."}
              </TabEmptyState>
            }
          />
        </Animated.View>
      )}

      <FilterSheet
        visible={filterOpen}
        title="Filter field guide"
        onClose={() => setFilterOpen(false)}
        onReset={() => setGuideFilters(DEFAULT_FIELD_GUIDE_FILTERS)}
        sections={[
          {
            title: "Rarity",
            value: guideFilters.rarity,
            onSelect: (value) =>
              setGuideFilters((prev) => ({
                ...prev,
                rarity: value as FeedRarityFilter,
              })),
            options: [
              { value: "all", label: "All" },
              { value: "common", label: "Common" },
              { value: "uncommon", label: "Uncommon" },
              { value: "rare", label: "Rare" },
            ],
          },
          {
            title: "Logged",
            value: guideFilters.logged,
            onSelect: (value) =>
              setGuideFilters((prev) => ({
                ...prev,
                logged: value as FieldGuideLoggedFilter,
              })),
            options: [
              { value: "all", label: "All species" },
              { value: "logged", label: loggedFilterLabel },
              { value: "unlogged", label: "Not logged yet" },
            ],
          },
        ]}
      />
        </>
      )}
    </View>
  );
}
