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
import { ScreenHeader } from "@/components/ScreenHeader";
import { SightingCard } from "@/components/SightingCard";
import { useAuth } from "@/hooks/useAuth";
import { useActivity } from "@/hooks/useActivity";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useFeed, type FeedFilter } from "@/hooks/useFeed";
import { getMyProfile } from "@/lib/sightings";

const FILTERS = ["nearby", "following", "rare", "activity"] as const;
type Tab = (typeof FILTERS)[number];

const EMPTY_COPY: Record<FeedFilter, string> = {
  nearby: "No sightings within your radius yet. Be the first to log one nearby.",
  following: "Sightings from people you follow will appear here.",
  rare: "No rare sightings reported recently.",
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
  const [tab, setTab] = useState<Tab>("nearby");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!userId) return;
    getMyProfile(userId)
      .then((p) => {
        if (p?.search_radius_km) setRadiusKm(p.search_radius_km);
      })
      .catch(() => {});
  }, [userId]);

  const isActivity = tab === "activity";
  const feedFilter: FeedFilter = isActivity ? "nearby" : tab;

  const {
    sightings,
    likedIds,
    loading: feedLoading,
    refreshing: feedRefreshing,
    error: feedError,
    needsLocation,
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

  const visibleSightings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sightings;
    return sightings.filter(
      (s) =>
        s.species.toLowerCase().includes(q) ||
        (s.location_name ?? "").toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q),
    );
  }, [sightings, search]);

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

        <View className="flex-row items-center gap-2">
          {FILTERS.map((f) => {
            const active = tab === f;
            return (
              <Pressable
                key={f}
                onPress={() => setTab(f)}
                className={`rounded-full px-3 py-1 ${
                  active ? "bg-primary" : "border border-border bg-card"
                }`}
              >
                <Text
                  className={`text-xs capitalize ${
                    active ? "font-sans-medium text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {f}
                </Text>
              </Pressable>
            );
          })}
          {!isActivity && (
            <View className="ml-auto rounded-full border border-border bg-card p-1.5">
              <Filter size={13} color="#8a9e82" />
            </View>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-8 gap-4"
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
              No activity yet. Likes and follows will show up here.
            </CenterMessage>
          ) : (
            activity.map((event) => <ActivityRow key={event.id} event={event} />)
          )
        ) : needsLocation ? (
          <View className="items-center px-8 pt-16">
            <MapPin size={28} color="#8a9e82" />
            <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
              {locStatus === "denied"
                ? "Location permission is needed to show nearby sightings."
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
              feedFilter === "following"
                ? { label: "Find birders to follow", onPress: () => router.push("/users") }
                : feedFilter === "nearby"
                  ? { label: "Find birders near you", onPress: () => router.push("/users") }
                  : undefined
            }
          >
            {EMPTY_COPY[feedFilter]}
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
    </SafeAreaView>
  );
}
