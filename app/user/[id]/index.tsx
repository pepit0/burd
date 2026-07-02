import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Grid3X3, ShieldAlert } from "lucide-react-native";
import { FollowButton } from "@/components/FollowButton";
import { ProfileBadges } from "@/components/ProfileBadges";
import { ProfileCoverBanner } from "@/components/ProfileCoverBanner";
import {
  filterProfileSightings,
  ProfilePostsFilterBar,
  type ProfilePostsFilter,
} from "@/components/ProfilePostsFilter";
import { ProfileStatsRow } from "@/components/ProfileStatsRow";
import { SightingPostsGrid } from "@/components/SightingPostsGrid";
import { UserModerationSheet } from "@/components/UserModerationSheet";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useUserProfile } from "@/hooks/useUserProfile";
import { buildProfileBadges } from "@/lib/profileBadges";
import { requestFieldGuideView } from "@/lib/navigationIntent";

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const { isAdmin } = useAdmin(currentUserId);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [postsFilter, setPostsFilter] = useState<ProfilePostsFilter>("all");

  const {
    profile,
    followers,
    following,
    sightings,
    followingThem,
    isSelf,
    loading,
    error,
    toggleFollow,
    refresh,
  } = useUserProfile(id ?? null, currentUserId);

  useEffect(() => {
    if (isSelf) {
      router.replace("/(tabs)/profile");
    }
  }, [isSelf, router]);

  const speciesCount = useMemo(
    () => new Set(sightings.map((s) => s.species.toLowerCase())).size,
    [sightings],
  );
  const photoCount = useMemo(
    () => sightings.filter((s) => s.photo_url).length,
    [sightings],
  );
  const rareCount = useMemo(
    () => sightings.filter((s) => s.rarity === "rare").length,
    [sightings],
  );

  const badges = useMemo(
    () =>
      buildProfileBadges({
        sightingsCount: sightings.length,
        photoCount,
        rareCount,
        following,
      }),
    [sightings.length, photoCount, rareCount, following],
  );

  const filteredSightings = useMemo(
    () => filterProfileSightings(sightings, postsFilter),
    [sightings, postsFilter],
  );

  const emptyPostsLabel =
    postsFilter === "photos"
      ? "No photo posts yet."
      : postsFilter === "audio"
        ? "No audio posts yet."
        : "No sightings yet.";

  const displayName = profile?.full_name || profile?.username || "Birder";
  const profileId = id ?? "";

  const stats: {
    label: string;
    value: number;
    onPress: () => void;
  }[] = [
    {
      label: "Sightings",
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
      label: "Followers",
      value: followers,
      onPress: () =>
        router.push({
          pathname: "/follows",
          params: { tab: "followers", profileId },
        }),
    },
    {
      label: "Following",
      value: following,
      onPress: () =>
        router.push({
          pathname: "/follows",
          params: { tab: "following", profileId },
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
            <View className="flex-row items-end justify-between">
              <View
                className="mb-3 h-[72px] w-[72px] overflow-hidden rounded-full border-[3px] border-background"
                style={{ backgroundColor: profile.avatar_color }}
              >
                {profile.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Text className="font-serif-semibold text-2xl text-primary-foreground">
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              {!isSelf ? (
                <View className="mb-3 flex-row gap-2">
                  <FollowButton following={followingThem} onPress={toggleFollow} size="md" />
                  {isAdmin ? (
                    <Pressable
                      onPress={() => setModerationOpen(true)}
                      className="flex-row items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-2 active:opacity-90"
                    >
                      <ShieldAlert size={14} color="#f87171" />
                      <Text className="font-sans-medium text-xs text-foreground">Moderate</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <Text className="font-serif-semibold text-xl text-foreground">
              {displayName}
            </Text>
            <Text className="mt-0.5 font-mono text-xs text-muted-foreground">
              @{profile.username}
              {profile.location_name ? ` · ${profile.location_name}` : ""}
            </Text>
            {profile.bio ? (
              <Text className="mt-2.5 font-sans text-sm leading-relaxed text-foreground/70">
                {profile.bio}
              </Text>
            ) : null}

            <ProfileStatsRow stats={stats} />
          </View>

          <View className="mt-5 border-t border-border">
            <View className="flex-row items-center justify-center gap-2 border-b border-border py-2.5">
              <Grid3X3 size={14} color="#c8893a" />
              <Text className="font-sans-medium text-xs uppercase tracking-wider text-foreground">
                Posts
              </Text>
            </View>
            <ProfilePostsFilterBar value={postsFilter} onChange={setPostsFilter} />

            <View className="px-4 pt-2">
              <SightingPostsGrid
                sightings={filteredSightings}
                emptyLabel={emptyPostsLabel}
                onPressSighting={(sightingId) => router.push(`/post/${sightingId}`)}
              />
            </View>
          </View>

          <View className="mt-8 px-4">
            <Text className="mb-3 font-serif-semibold text-base text-foreground">Badges</Text>
            <ProfileBadges badges={badges} />
          </View>
        </ScrollView>
      )}

      <UserModerationSheet
        visible={moderationOpen}
        profile={profile}
        onClose={() => setModerationOpen(false)}
        onUpdated={() => void refresh()}
      />
    </SafeAreaView>
  );
}
