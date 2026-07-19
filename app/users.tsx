import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, MapPin, Search, Users } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { DisplayNameText } from "@/components/DisplayNameText";
import { FollowButton } from "@/components/FollowButton";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { getMyProfile } from "@/lib/sightings";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getNearbyBirders,
  searchUsers,
  sendFriendRequest,
  unfriendUser,
  type UserListItem,
} from "@/lib/social";
import { getLoadErrorMessage } from "@/lib/errors";

type DiscoverMode = "nearby" | "all";

export default function UsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { coords, status: locStatus, refresh: refreshLocation } =
    useCurrentLocation();

  const [mode, setMode] = useState<DiscoverMode>("nearby");
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(25);
  const [results, setResults] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    getMyProfile(userId)
      .then((profile) => {
        if (profile?.search_radius_km) setRadiusKm(profile.search_radius_km);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    if (mode === "nearby" && !coords) {
      setResults([]);
      setLoading(locStatus === "loading");
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const t = setTimeout(async () => {
      try {
        const rows =
          mode === "nearby" && coords
            ? await getNearbyBirders(
                coords.latitude,
                coords.longitude,
                radiusKm,
                userId,
                query,
              )
            : await searchUsers(query, userId);

        if (!cancelled) {
          setResults(rows);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(getLoadErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, userId, mode, coords, radiusKm, locStatus]);

  const toggleFriend = useCallback(
    (target: UserListItem) => {
      if (!userId) return;
      const prev = target.status;
      const apply = (next: UserListItem["status"]) =>
        setResults((rows) =>
          rows.map((u) => (u.id === target.id ? { ...u, status: next } : u)),
        );

      if (prev === "friends") {
        apply("none");
        unfriendUser(target.id).catch(() => apply("friends"));
        return;
      }
      if (prev === "outgoing") {
        apply("none");
        cancelFriendRequest(target.id).catch(() => apply("outgoing"));
        return;
      }
      if (prev === "incoming") {
        apply("friends");
        acceptFriendRequest(target.id).catch(() => apply("incoming"));
        return;
      }

      apply("outgoing");
      sendFriendRequest(target.id).catch(() => apply("none"));
    },
    [userId],
  );

  const declineRequest = useCallback(
    (target: UserListItem) => {
      if (!userId) return;
      if (target.status !== "incoming") return;
      setResults((rows) => rows.filter((u) => u.id !== target.id));
      declineFriendRequest(target.id).catch(() => {
        // fall back to reload next tick by forcing state update
        setResults((rows) => rows);
      });
    },
    [userId],
  );

  const emptyCopy =
    mode === "nearby"
      ? query.trim()
        ? "No nearby birders match your search."
        : locStatus === "denied"
          ? "Turn on location to discover birders near you."
          : "No other birders nearby yet. Try All birders or widen your radius in Profile."
      : query.trim()
        ? "No birders match your search."
        : "No other birders yet.";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 border-b border-border px-3 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-1">
          <ChevronLeft size={22} color="#8a9e82" />
        </Pressable>
        <Text className="font-serif-semibold text-lg text-foreground">
          Find Birders
        </Text>
      </View>

      <KeyboardScreen
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-12 pt-3"
      >
        <View className="gap-3 pb-2">
          <View className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
            <Search size={14} color="#8a9e82" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or @username..."
              placeholderTextColor="#8a9e82"
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 font-sans text-sm text-foreground"
            />
          </View>

          <View className="flex-row gap-2">
            {(["nearby", "all"] as const).map((tab) => {
              const active = mode === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setMode(tab)}
                  className={`rounded-full px-3.5 py-1.5 ${
                    active ? "bg-primary" : "border border-border bg-card"
                  }`}
                >
                  <Text
                    className={`text-xs capitalize ${
                      active
                        ? "font-sans-medium text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {tab === "nearby" ? "Nearby" : "All birders"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === "nearby" && coords ? (
            <Text className="font-sans text-[11px] text-muted-foreground">
              Within {radiusKm} km · add birders to see their posts in Friends
            </Text>
          ) : null}
        </View>

        {mode === "nearby" && locStatus === "denied" ? (
          <View className="items-center px-4 pt-12">
            <MapPin size={28} color="#8a9e82" />
            <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
              Location helps find birders who post near you.
            </Text>
            <Pressable
              onPress={refreshLocation}
              className="mt-4 rounded-xl bg-primary px-4 py-2.5"
            >
              <Text className="font-sans-medium text-sm text-primary-foreground">
                Enable location
              </Text>
            </Pressable>
            <Pressable onPress={() => setMode("all")} className="mt-3 px-4 py-2">
              <Text className="font-sans text-sm text-accent">Browse all birders</Text>
            </Pressable>
          </View>
        ) : loading && results.length === 0 ? (
          <ActivityIndicator className="mt-12" color="#5f9470" />
        ) : error ? (
          <Text className="mt-12 text-center font-sans text-sm text-muted-foreground">
            {error}
          </Text>
        ) : results.length === 0 ? (
          <View className="items-center px-4 pt-12">
            <Users size={28} color="#8a9e82" />
            <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
              {emptyCopy}
            </Text>
            {mode === "nearby" ? (
              <Pressable onPress={() => setMode("all")} className="mt-4 px-4 py-2">
                <Text className="font-sans text-sm text-accent">Browse all birders</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View className="gap-1">
            {results.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => router.push(`/user/${u.id}`)}
                className="flex-row items-center gap-3 rounded-xl py-2.5 active:bg-card"
              >
                <Avatar
                  user={u.username}
                  color={u.avatar_color}
                  avatarUrl={u.avatar_url}
                  size={42}
                />
                <View className="min-w-0 flex-1">
                  <DisplayNameText
                    text={u.full_name || u.username}
                    className="font-sans-medium text-sm text-foreground"
                    numberOfLines={1}
                  />
                  <Text
                    className="font-mono text-xs text-muted-foreground"
                    numberOfLines={1}
                  >
                    @{u.username}
                  </Text>
                  {u.subtitle ? (
                    <Text
                      className="mt-0.5 font-sans text-[11px] text-muted-foreground/80"
                      numberOfLines={1}
                    >
                      {u.subtitle}
                    </Text>
                  ) : null}
                </View>
                <FollowButton
                  status={u.status}
                  onPress={() => toggleFriend(u)}
                  onSecondaryPress={() => declineRequest(u)}
                />
              </Pressable>
            ))}
          </View>
        )}
      </KeyboardScreen>
    </SafeAreaView>
  );
}
