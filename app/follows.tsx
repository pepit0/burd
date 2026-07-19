import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Search, Users } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { DisplayNameText } from "@/components/DisplayNameText";
import { FollowButton } from "@/components/FollowButton";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { useAuth } from "@/hooks/useAuth";
import { useRetryOnRecover } from "@/hooks/useRetryOnRecover";
import { getLoadErrorMessage } from "@/lib/errors";
import { getMyProfile } from "@/lib/sightings";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getFriendsList,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  sendFriendRequest,
  unfriendUser,
  type UserListItem,
} from "@/lib/social";
import type { Profile } from "@/types";

type FriendsTab = "requests" | "friends";

function matchesQuery(item: UserListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.username.toLowerCase().includes(q) ||
    (item.full_name ?? "").toLowerCase().includes(q)
  );
}

export default function FollowsScreen() {
  const router = useRouter();
  const { tab = "friends", profileId: profileIdParam } = useLocalSearchParams<{
    tab?: FriendsTab;
    profileId?: string | string[];
  }>();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const profileId = Array.isArray(profileIdParam) ? profileIdParam[0] : profileIdParam;
  const profileUserId = profileId ?? userId;
  const isOwnList = !profileId || profileId === userId;

  const mode: FriendsTab = tab === "requests" ? "requests" : "friends";
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userId || !profileUserId) return;
    if (!opts?.silent) setLoading(true);
    try {
      const listPromise =
        mode === "requests"
          ? isOwnList
            ? Promise.all([
                getIncomingFriendRequests(userId),
                getOutgoingFriendRequests(userId),
              ]).then(([incoming, outgoing]) => [...incoming, ...outgoing])
            : Promise.resolve([])
          : getFriendsList(profileUserId, userId);

      const [list, owner] = await Promise.all([
        listPromise,
        !isOwnList ? getMyProfile(profileUserId) : Promise.resolve(null),
      ]);
      setRows(Array.isArray(list) ? list : []);
      setOwnerProfile(owner);
      setError(null);
    } catch (e) {
      setError(getLoadErrorMessage(e));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [isOwnList, mode, profileUserId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRetryOnRecover(error, () => load({ silent: true }));

  const visible = useMemo(
    () => rows.filter((row) => matchesQuery(row, query)),
    [rows, query],
  );

  const toggleFriend = useCallback(
    (target: UserListItem) => {
      if (!userId || target.id === userId) return;
      const prev = target.status;

      const apply = (next: UserListItem["status"]) =>
        setRows((rows) => rows.map((u) => (u.id === target.id ? { ...u, status: next } : u)));

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
        // Primary action: accept.
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
      if (!userId || target.id === userId) return;
      if (target.status !== "incoming") return;
      setRows((rows) => rows.filter((u) => u.id !== target.id));
      declineFriendRequest(target.id).catch(() => void load());
    },
    [load, userId],
  );

  const ownerHandle = ownerProfile?.username ? `@${ownerProfile.username}` : "This birder";
  const title = isOwnList
    ? mode === "requests"
      ? "Friend requests"
      : "Friends"
    : `${ownerHandle}'s friends`;

  const emptyCopy = mode === "requests"
    ? query.trim()
      ? "No requests match your search."
      : "No friend requests right now."
    : query.trim()
      ? "No friends match your search."
      : isOwnList
        ? "No friends yet."
        : `${ownerHandle} has no friends yet.`;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 border-b border-border px-3 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-1">
          <ChevronLeft size={22} color="#8a9e82" />
        </Pressable>
        <Text className="font-serif-semibold text-lg text-foreground">{title}</Text>
      </View>

      <KeyboardScreen
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-12 pt-3"
      >
        <View className="mb-3 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
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

        {loading && rows.length === 0 ? (
          <ActivityIndicator className="mt-12" color="#5f9470" />
        ) : error ? (
          <Text className="mt-12 text-center font-sans text-sm text-muted-foreground">
            {error}
          </Text>
        ) : visible.length === 0 ? (
          <View className="items-center px-4 pt-12">
            <Users size={28} color="#8a9e82" />
            <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
              {emptyCopy}
            </Text>
            {mode === "friends" && !query.trim() && isOwnList ? (
              <Pressable
                onPress={() => router.push("/users")}
                className="mt-4 rounded-xl bg-primary px-4 py-2.5"
              >
                <Text className="font-sans-medium text-sm text-primary-foreground">
                  Add birders
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View className="gap-1">
            {visible.map((u) => (
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
                {u.id !== userId ? (
                  <FollowButton
                    status={u.status}
                    onPress={() => toggleFriend(u)}
                    onSecondaryPress={() => declineRequest(u)}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </KeyboardScreen>
    </SafeAreaView>
  );
}
