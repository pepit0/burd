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
import { FollowButton } from "@/components/FollowButton";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/errors";
import { getMyProfile } from "@/lib/sightings";
import {
  followUser,
  getFollowersList,
  getFollowingList,
  unfollowUser,
  type UserListItem,
} from "@/lib/social";
import type { Profile } from "@/types";

type FollowTab = "followers" | "following";

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
  const { tab = "followers", profileId: profileIdParam } = useLocalSearchParams<{
    tab?: FollowTab;
    profileId?: string | string[];
  }>();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const profileId = Array.isArray(profileIdParam) ? profileIdParam[0] : profileIdParam;
  const profileUserId = profileId ?? userId;
  const isOwnList = !profileId || profileId === userId;

  const mode: FollowTab = tab === "following" ? "following" : "followers";
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId || !profileUserId) return;
    setLoading(true);
    try {
      const [list, owner] = await Promise.all([
        mode === "followers"
          ? getFollowersList(profileUserId, userId)
          : getFollowingList(profileUserId, userId),
        !isOwnList ? getMyProfile(profileUserId) : Promise.resolve(null),
      ]);
      setRows(list);
      setOwnerProfile(owner);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [isOwnList, mode, profileUserId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => rows.filter((row) => matchesQuery(row, query)),
    [rows, query],
  );

  const toggleFollow = useCallback(
    (target: UserListItem) => {
      if (!userId || target.id === userId) return;
      const willFollow = !target.isFollowing;
      setRows((prev) =>
        prev.map((u) =>
          u.id === target.id ? { ...u, isFollowing: willFollow } : u,
        ),
      );
      const action = willFollow ? followUser : unfollowUser;
      action(userId, target.id).catch(() => {
        setRows((prev) =>
          prev.map((u) =>
            u.id === target.id ? { ...u, isFollowing: !willFollow } : u,
          ),
        );
      });
    },
    [userId],
  );

  const ownerHandle = ownerProfile?.username ? `@${ownerProfile.username}` : "This birder";
  const title = isOwnList
    ? mode === "followers"
      ? "Followers"
      : "Following"
    : mode === "followers"
      ? `${ownerHandle}'s followers`
      : `${ownerHandle} is following`;

  const emptyCopy =
    mode === "followers"
      ? query.trim()
        ? "No followers match your search."
        : isOwnList
          ? "No followers yet."
          : `${ownerHandle} has no followers yet.`
      : query.trim()
        ? "No followed birders match your search."
        : isOwnList
          ? "You are not following anyone yet."
          : `${ownerHandle} is not following anyone yet.`;

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
            {mode === "following" && !query.trim() && isOwnList ? (
              <Pressable
                onPress={() => router.push("/users")}
                className="mt-4 rounded-xl bg-primary px-4 py-2.5"
              >
                <Text className="font-sans-medium text-sm text-primary-foreground">
                  Find birders
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
                <Avatar user={u.username} color={u.avatar_color} size={42} />
                <View className="min-w-0 flex-1">
                  <Text
                    className="font-sans-medium text-sm text-foreground"
                    numberOfLines={1}
                  >
                    {u.full_name || u.username}
                  </Text>
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
                    following={u.isFollowing}
                    onPress={() => toggleFollow(u)}
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
