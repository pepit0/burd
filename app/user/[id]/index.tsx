import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MoreHorizontal, ShieldAlert } from "lucide-react-native";
import { FollowButton } from "@/components/FollowButton";
import { DisplayNameWithBadges } from "@/components/DisplayNameWithBadges";
import { ProfileAvatarPeek } from "@/components/ProfileAvatarPeek";
import { ProfileBadgesPreview } from "@/components/ProfileBadges";
import { ProfileCoverBanner } from "@/components/ProfileCoverBanner";
import {
  filterProfileSightings,
  ProfilePostsFilterBar,
  type ProfilePostsFilter,
} from "@/components/ProfilePostsFilter";
import { ProfileStatsRow } from "@/components/ProfileStatsRow";
import { LinkableText } from "@/components/LinkableText";
import { SightingPostsGrid } from "@/components/SightingPostsGrid";
import { UserModerationSheet } from "@/components/UserModerationSheet";
import { UserOptionsMenu } from "@/components/UserOptionsMenu";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useProfileBadges } from "@/hooks/useProfileBadges";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useReposts } from "@/hooks/useReposts";
import { requestFieldGuideView } from "@/lib/navigationIntent";
import { stripDisplayNameColorCodes } from "@/lib/displayNameColors";

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const { isAdmin } = useAdmin(currentUserId);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [userOptionsOpen, setUserOptionsOpen] = useState(false);
  const [postsFilter, setPostsFilter] = useState<ProfilePostsFilter>("all");

  const {
    profile,
    friends,
    sightings,
    status,
    isSelf,
    loading,
    error,
    toggleFriend,
    declineRequest,
    refresh,
  } = useUserProfile(id ?? null, currentUserId);
  const { reposts } = useReposts(id ?? null);

  useEffect(() => {
    if (isSelf) {
      router.replace("/(tabs)/profile");
    }
  }, [isSelf, router]);

  const speciesCount = useMemo(
    () => new Set(sightings.map((s) => s.species.toLowerCase())).size,
    [sightings],
  );
  const { badges, earnedCount } = useProfileBadges(id ?? null, sightings, friends);

  const filteredSightings = useMemo(
    () => filterProfileSightings(sightings, postsFilter),
    [sightings, postsFilter],
  );
  const gridPosts = postsFilter === "reposts" ? reposts : filteredSightings;

  const emptyPostsLabel =
    postsFilter === "reposts"
      ? "No reposts yet."
      : postsFilter === "photos"
      ? "No photo posts yet."
      : postsFilter === "audio"
        ? "No audio posts yet."
        : "No sightings yet.";

  const displayName = profile?.full_name || profile?.username || "Birder";
  const displayNamePlain = stripDisplayNameColorCodes(displayName);
  const profileId = id ?? "";

  const stats: {
    label: string;
    value: number;
    onPress: () => void;
  }[] = [
    {
      label: "Posts",
      value: sightings.length,
      onPress: () => router.push(`/user/${profileId}/journal`),
    },
    {
      label: "Species",
      value: speciesCount,
      onPress: () => {
        requestFieldGuideView({ sortLoggedFirst: true, userId: profileId });
        router.push("/(tabs)/field-guide");
      },
    },
    {
      label: "Friends",
      value: friends,
      onPress: () =>
        router.push({
          pathname: "/follows",
          params: { tab: "friends", profileId },
        }),
    },
  ];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center border-b border-border px-3 pb-2.5 pt-1">
        <Pressable onPress={() => router.back()} className="p-1">
          <ChevronLeft size={22} color="#8a9e82" />
        </Pressable>
        <Text
          className="mx-2 flex-1 text-center font-mono text-sm text-foreground"
          numberOfLines={1}
        >
          {profile ? `@${profile.username}` : "Profile"}
        </Text>
        <View className="w-8" />
      </View>

      {loading && !profile ? (
        <ActivityIndicator className="mt-20" color="#5f9470" />
      ) : error ? (
        <Text className="mt-20 px-8 text-center font-sans text-sm text-muted-foreground">
          {error}
        </Text>
      ) : !profile ? (
        <Text className="mt-20 px-8 text-center font-sans text-sm text-muted-foreground">
          This birder could not be found.
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-12">
          <ProfileCoverBanner coverUrl={profile.cover_url} />

          <View className="-mt-9 px-4">
            <View className="mb-3">
              <ProfileAvatarPeek
                avatarUrl={profile.avatar_url}
                avatarColor={profile.avatar_color}
                displayName={displayNamePlain}
              />
            </View>

            {!isSelf ? (
              <View className="absolute right-6 top-4 z-10 flex-row gap-2">
                {isAdmin ? (
                  <Pressable
                    onPress={() => setModerationOpen(true)}
                    className="flex-row items-center gap-1 rounded-full border border-destructive/40 bg-destructive/20 px-3 py-2 active:opacity-90"
                  >
                    <ShieldAlert size={14} color="#f87171" />
                    <Text className="font-sans-medium text-xs text-foreground">Moderate</Text>
                  </Pressable>
                ) : null}
                <FollowButton
                  status={status}
                  onPress={toggleFriend}
                  onSecondaryPress={declineRequest}
                  size="md"
                />
                <Pressable
                  onPress={() => setUserOptionsOpen(true)}
                  className="rounded-full border border-border bg-card/90 p-2 active:opacity-90"
                  accessibilityLabel="User options"
                >
                  <MoreHorizontal size={18} color="#8a9e82" />
                </Pressable>
              </View>
            ) : null}

            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <DisplayNameWithBadges
                  text={displayName}
                  isVerified={profile.is_verified}
                  isBeta={profile.is_beta}
                  badgeSize="md"
                  className="font-serif-semibold text-xl text-foreground"
                />
                <Text className="mt-0.5 font-mono text-xs text-muted-foreground">
                  @{profile.username}
                  {profile.location_name ? ` · ${profile.location_name}` : ""}
                </Text>
              </View>
              <View className="mr-2">
                <ProfileStatsRow stats={stats} variant="inline" />
              </View>
            </View>

            {profile.bio ? (
              <LinkableText className="mt-2.5 font-sans text-sm leading-relaxed text-foreground/70">
                {profile.bio}
              </LinkableText>
            ) : null}
          </View>

          <View className="mt-6 border-t border-border">
            <ProfilePostsFilterBar value={postsFilter} onChange={setPostsFilter} />
            <View className="px-4 pt-2">
              <SightingPostsGrid
                sightings={gridPosts}
                emptyLabel={emptyPostsLabel}
                onPressSighting={(sightingId) => router.push(`/post/${sightingId}`)}
              />
            </View>
          </View>

          <View className="mt-8 px-4">
            <ProfileBadgesPreview
              badges={badges}
              earnedCount={earnedCount}
              userId={profileId}
              username={profile.username}
            />
          </View>
        </ScrollView>
      )}

      <UserModerationSheet
        visible={moderationOpen}
        profile={profile}
        onClose={() => setModerationOpen(false)}
        onUpdated={() => void refresh()}
      />

      {profile ? (
        <UserOptionsMenu
          targetUserId={profile.id}
          targetUsername={profile.username}
          viewerUserId={currentUserId}
          visible={userOptionsOpen}
          onClose={() => setUserOptionsOpen(false)}
          onBlocked={() => router.back()}
        />
      ) : null}
    </SafeAreaView>
  );
}
