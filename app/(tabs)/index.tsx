import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Filter } from "lucide-react-native";
import { SearchBar } from "@/components/SearchBar";
import { ActivityRow } from "@/components/ActivityRow";
import { FilterSheet } from "@/components/FilterSheet";
import { ScrollScreen } from "@/components/ScrollScreen";
import { TabEmptyState } from "@/components/TabEmptyState";
import { SightingCard } from "@/components/SightingCard";
import { useAuth } from "@/hooks/useAuth";
import { useActivity } from "@/hooks/useActivity";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useFeed, type FeedFilter } from "@/hooks/useFeed";
import {
  applyFeedContentFilters,
  countActiveFeedFilters,
  DEFAULT_FEED_CONTENT_FILTERS,
  type FeedContentFilters,
  type FeedNearbyFilter,
  type FeedRarityFilter,
} from "@/lib/filters";
import { getMyProfile } from "@/lib/sightings";
import { isSpeciesRarityVisible } from "@/lib/rarity";
import type { ActivityItem, FeedSighting } from "@/types";

const HOME_TABS = [
  { id: "for_you", label: "For you" },
  { id: "following", label: "Friends" },
  { id: "new", label: "New" },
  { id: "activity", label: "Activity" },
] as const;

type Tab = (typeof HOME_TABS)[number]["id"];

const EMPTY_COPY: Record<FeedFilter, string> = {
  for_you:
    "No suggestions yet. Explore New or find birders near you to get personalized picks.",
  following: "Posts from birders you're friends with will appear here.",
  new: "No new sightings from around the world yet.",
};

function TabChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-3 py-1 ${
        active ? "bg-primary" : "border border-border bg-card"
      }`}
    >
      <Text
        className={`text-xs ${
          active ? "font-sans-medium text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { coords, status: locStatus, refresh: refreshLocation } = useCurrentLocation();
  const [radiusKm, setRadiusKm] = useState<number | null>(25);
  const [tab, setTab] = useState<Tab>("for_you");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [contentFilters, setContentFilters] = useState<FeedContentFilters>(
    DEFAULT_FEED_CONTENT_FILTERS,
  );
  const activeFilterCount = countActiveFeedFilters(contentFilters);

  useEffect(() => {
    if (!userId) return;
    getMyProfile(userId)
      .then((p) => {
        if (p) setRadiusKm(p.search_radius_km ?? null);
      })
      .catch(() => {});
  }, [userId]);

  const isActivity = tab === "activity";
  const feedFilter: FeedFilter = tab === "activity" ? "for_you" : tab;

  const {
    sightings,
    likedIds,
    loading: feedLoading,
    refreshing: feedRefreshing,
    error: feedError,
    refresh: refreshFeed,
    silentRefresh: silentRefreshFeed,
    toggleLike,
    removeBlockedAuthor,
  } = useFeed({
    filter: feedFilter,
    userId,
    coords,
    radiusKm,
    enabled: !isActivity,
  });

  const {
    activity,
    loading: activityLoading,
    refreshing: activityRefreshing,
    error: activityError,
    refresh: refreshActivity,
    silentRefresh: silentRefreshActivity,
  } = useActivity(userId, isActivity);

  const needsNearbyLocation =
    !isActivity && contentFilters.nearby === "nearby" && !coords;

  const visibleSightings = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = applyFeedContentFilters(sightings, contentFilters, {
      coords,
      radiusKm,
    });
    if (!q) return rows;
    return rows.filter(
      (s) =>
        s.species.toLowerCase().includes(q) ||
        (s.scientific_name ?? "").toLowerCase().includes(q) ||
        (s.location_name ?? "").toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q),
    );
  }, [sightings, search, contentFilters, coords, radiusKm]);

  const feedBusy = feedLoading && sightings.length === 0;
  const activityBusy = activityLoading && activity.length === 0;
  const refreshing = isActivity
    ? activityRefreshing || activityBusy
    : feedRefreshing || feedBusy;
  const onRefresh = isActivity ? refreshActivity : refreshFeed;

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (isActivity) {
        silentRefreshActivity();
      } else {
        silentRefreshFeed();
      }
    }, [isActivity, silentRefreshActivity, silentRefreshFeed]),
  );

  const toolbar = (
    <View className="gap-3 px-4">
      {!isActivity && (
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search sightings, species, locations..."
        />
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center gap-2 pr-2"
      >
        {HOME_TABS.map((item) => (
          <TabChip
            key={item.id}
            label={item.label}
            active={tab === item.id}
            onPress={() => setTab(item.id)}
          />
        ))}
        {!isActivity && (
          <Pressable
            onPress={() => setFilterOpen(true)}
            className={`ml-1 rounded-full border p-1.5 active:opacity-80 ${
              activeFilterCount > 0
                ? "border-primary bg-primary/15"
                : "border-border bg-card"
            }`}
          >
            <Filter
              size={13}
              color={activeFilterCount > 0 ? "#5f9470" : "#8a9e82"}
            />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );

  type HomeListItem =
    | { kind: "activity"; event: ActivityItem }
    | { kind: "sighting"; sighting: FeedSighting };

  const listData = useMemo((): HomeListItem[] => {
    if (isActivity) {
      return activity.map((event) => ({ kind: "activity", event }));
    }
    if (needsNearbyLocation || feedError || feedBusy) {
      return [];
    }
    return visibleSightings.map((sighting) => ({ kind: "sighting", sighting }));
  }, [
    activity,
    feedBusy,
    feedError,
    isActivity,
    needsNearbyLocation,
    visibleSightings,
  ]);

  const feedHandlersRef = useRef({
    likedIds,
    toggleLike,
    removeBlockedAuthor,
  });
  feedHandlersRef.current = { likedIds, toggleLike, removeBlockedAuthor };

  const renderListItem = useCallback(
    ({ item }: { item: HomeListItem }) => {
      if (item.kind === "activity") {
        return <ActivityRow event={item.event} />;
      }

      const { sighting } = item;
      const handlers = feedHandlersRef.current;
      return (
        <SightingCard
          sighting={sighting}
          liked={handlers.likedIds.has(sighting.id)}
          onToggleLike={() => handlers.toggleLike(sighting.id)}
          onUserBlocked={handlers.removeBlockedAuthor}
        />
      );
    },
    [],
  );

  const listKeyExtractor = useCallback((item: HomeListItem) => {
    return item.kind === "activity" ? item.event.id : item.sighting.id;
  }, []);

  const listEmptyComponent = useMemo(() => {
    if (isActivity) {
      if (activityError) {
        return <TabEmptyState>{activityError}</TabEmptyState>;
      }
      if (activity.length === 0 && !activityBusy) {
        return (
          <TabEmptyState>
            No activity yet. Likes and friend requests will show up here.
          </TabEmptyState>
        );
      }
      return null;
    }

    if (needsNearbyLocation) {
      return (
        <TabEmptyState
          action={{
            label: locStatus === "denied" ? "Enable location" : "Retry",
            onPress: refreshLocation,
          }}
        >
          {locStatus === "denied"
            ? "Location permission is needed for the nearby filter."
            : "Finding your location…"}
        </TabEmptyState>
      );
    }

    if (feedError) {
      return <TabEmptyState>{feedError}</TabEmptyState>;
    }

    if (visibleSightings.length === 0 && !feedBusy) {
      return (
        <TabEmptyState
          action={
            activeFilterCount > 0 || search.trim()
              ? undefined
              : feedFilter === "following"
                ? { label: "Add birders", onPress: () => router.push("/users") }
                : feedFilter === "for_you"
                  ? {
                      label: "Find birders near you",
                      onPress: () => router.push("/users"),
                    }
                  : undefined
          }
        >
          {activeFilterCount > 0 || search.trim()
            ? "No sightings match your search or filters."
            : EMPTY_COPY[feedFilter]}
        </TabEmptyState>
      );
    }

    if (feedBusy) {
      return <TabEmptyState loading />;
    }

    return null;
  }, [
    activeFilterCount,
    activity.length,
    activityBusy,
    activityError,
    feedBusy,
    feedError,
    feedFilter,
    isActivity,
    locStatus,
    needsNearbyLocation,
    refreshLocation,
    router,
    search,
    visibleSightings.length,
  ]);

  return (
    <>
      <ScrollScreen
        title="Burd"
        showLogo
        hideHeaderOnScroll
        toolbar={toolbar}
        listData={listData}
        listKeyExtractor={listKeyExtractor}
        renderListItem={renderListItem}
        ListEmptyComponent={listEmptyComponent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5f9470" />
        }
      />

      <FilterSheet
        visible={filterOpen}
        title="Filter home"
        onClose={() => setFilterOpen(false)}
        onReset={() => setContentFilters(DEFAULT_FEED_CONTENT_FILTERS)}
        sections={[
          {
            title: "Location",
            value: contentFilters.nearby,
            onSelect: (value) =>
              setContentFilters((prev) => ({
                ...prev,
                nearby: value as FeedNearbyFilter,
              })),
            options: [
              { value: "all", label: "Anywhere" },
              { value: "nearby", label: "Nearby only" },
            ],
          },
          ...(isSpeciesRarityVisible()
            ? [
                {
                  title: "Rarity",
                  value: contentFilters.rarity,
                  onSelect: (value: string) =>
                    setContentFilters((prev) => ({
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
              ]
            : []),
        ]}
      />
    </>
  );
}
