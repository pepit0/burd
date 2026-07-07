import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Filter,
  MapPin,
  Search,
} from "lucide-react-native";
import { ActivityRow } from "@/components/ActivityRow";
import { FilterSheet } from "@/components/FilterSheet";
import { ScreenHeader } from "@/components/ScreenHeader";
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

const FEED_TABS = [
  { id: "for_you", label: "For you" },
  { id: "following", label: "Friends" },
  { id: "new", label: "New" },
  { id: "activity", label: "Activity" },
] as const;

type Tab = (typeof FEED_TABS)[number]["id"];

const EMPTY_COPY: Record<FeedFilter, string> = {
  for_you:
    "No suggestions yet. Explore New or find birders near you to get personalized picks.",
  following: "Posts from birders you’re friends with will appear here.",
  new: "No new sightings from around the world yet.",
};

function CenterMessage({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="items-center px-8 pt-16">
      <Text className="text-center font-sans text-sm leading-relaxed text-muted-foreground">
        {children}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          className="mt-4 rounded-xl bg-primary px-4 py-2.5 active:opacity-90"
        >
          <Text className="font-sans-medium text-sm text-primary-foreground">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { coords, status: locStatus, refresh: refreshLocation } = useCurrentLocation();
  const [radiusKm, setRadiusKm] = useState(25);
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
        if (p?.search_radius_km) setRadiusKm(p.search_radius_km);
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

  const refreshing = isActivity ? activityRefreshing : feedRefreshing;
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

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Burd" showLogo />

      <View className="gap-3 px-4 pb-3 pt-3">
        {!isActivity && (
          <View className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
            <Search size={14} color="#8a9e82" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search sightings, species, locations..."
              placeholderTextColor="#8a9e82"
              className="flex-1 font-sans text-sm text-foreground"
            />
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="flex-row items-center gap-2 pr-2"
        >
          {FEED_TABS.map((item) => {
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
                    active ? "font-sans-medium text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
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

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-28 gap-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#5f9470"
          />
        }
      >
        {isActivity ? (
          activityLoading && activity.length === 0 ? (
            <ActivityIndicator className="mt-16" color="#5f9470" />
          ) : activityError ? (
            <CenterMessage>{activityError}</CenterMessage>
          ) : activity.length === 0 ? (
            <CenterMessage>
              No activity yet. Likes and friend requests will show up here.
            </CenterMessage>
          ) : (
            activity.map((event) => <ActivityRow key={event.id} event={event} />)
          )
        ) : needsNearbyLocation ? (
          <View className="items-center px-8 pt-16">
            <MapPin size={28} color="#8a9e82" />
            <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
              {locStatus === "denied"
                ? "Location permission is needed for the nearby filter."
                : "Finding your location…"}
            </Text>
            <Pressable
              onPress={refreshLocation}
              className="mt-4 rounded-xl bg-primary px-4 py-2.5"
            >
              <Text className="font-sans-medium text-sm text-primary-foreground">
                {locStatus === "denied" ? "Enable location" : "Retry"}
              </Text>
            </Pressable>
          </View>
        ) : feedLoading && sightings.length === 0 ? (
          <ActivityIndicator className="mt-16" color="#5f9470" />
        ) : feedError ? (
          <CenterMessage>{feedError}</CenterMessage>
        ) : visibleSightings.length === 0 ? (
          <CenterMessage
            action={
              activeFilterCount > 0 || search.trim()
                ? undefined
                : feedFilter === "following"
                  ? { label: "Add birders", onPress: () => router.push("/users") }
                  : feedFilter === "for_you"
                    ? { label: "Find birders near you", onPress: () => router.push("/users") }
                    : undefined
            }
          >
            {activeFilterCount > 0 || search.trim()
              ? "No sightings match your search or filters."
              : EMPTY_COPY[feedFilter]}
          </CenterMessage>
        ) : (
          visibleSightings.map((s) => (
            <SightingCard
              key={s.id}
              sighting={s}
              liked={likedIds.has(s.id)}
              onToggleLike={() => toggleLike(s.id)}
            />
          ))
        )}
      </ScrollView>

      <FilterSheet
        visible={filterOpen}
        title="Filter feed"
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
          {
            title: "Rarity",
            value: contentFilters.rarity,
            onSelect: (value) =>
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
        ]}
      />
    </SafeAreaView>
  );
}
