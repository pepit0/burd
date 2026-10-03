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
import { ChevronLeft, MoreHorizontal } from "lucide-react-native";
import { FollowButton } from "@/components/FollowButton";
import { DisplayNameWithBadges } from "@/components/DisplayNameWithBadges";
import { ProfileAvatarPeek } from "@/components/ProfileAvatarPeek";
import { BadgeShowcaseSlot, ProfileBadgesPreview } from "@/components/ProfileBadges";
import {
  PROFILE_BANNER_HEIGHT,
  PROFILE_PET_SIZE,
  ProfileCoverWithPet,
} from "@/components/ProfileCoverWithPet";
import { PocketBirdPet } from "@/components/PocketBirdPet";
import { useAccessibility } from "@/components/AccessibilityProvider";
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
import { getPetSoundEnabled } from "@/lib/pocketBird/petSoundStorage";
import { isProfilePetVisible, resolveProfilePetHatId, resolveProfilePetSpeciesId } from "@/lib/profilePet";
import { stripDisplayNameColorCodes } from "@/lib/displayNameColors";
import { resolveShowcaseBadges } from "@/lib/profileShowcaseBadges";

/** Matches the profile header container's `-mt-9` so padded content sits below the banner. */
const PROFILE_BANNER_OVERLAP = 36;

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const { isAdmin } = useAdmin(currentUserId);
  const { reduceMotion } = useAccessibility();
  const [moderationOpen, setModerationOpen] = useState(false);
  const [userOptionsOpen, setUserOptionsOpen] = useState(false);
  const [postsFilter, setPostsFilter] = useState<ProfilePostsFilter>("all");
  const [petSoundEnabled, setPetSoundEnabled] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    void getPetSoundEnabled().then((enabled) => {
      if (!cancelled) setPetSoundEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
  const isPostsEmpty = gridPosts.length === 0;
  const showProfilePet = profile ? isProfilePetVisible(profile) : false;

  const stats: {
    label: string;
    value: number;
    onPress?: () => void;
  }[] = [
    {
      label: "Posts",
      value: sightings.length,
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
    },
  ];

  const showcaseSlots = useMemo(
    () => resolveShowcaseBadges(badges, profile?.showcase_badge_ids),
    [badges, profile?.showcase_badge_ids],
  );

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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="flex-grow pb-12">
          <View className="relative">
            <ProfileCoverWithPet
              coverUrl={profile.cover_url}
              profile={profile}
              suppressPet={showProfilePet}
            />

            <View className="-mt-9 px-4">
              <View className="flex-row items-start gap-2">
                <View style={{ marginTop: 8, marginBottom: -8, marginLeft: -3, flexShrink: 0 }}>
                  <ProfileAvatarPeek
                    avatarUrl={profile.avatar_url}
                    avatarColor={profile.avatar_color}
                    displayName={displayNamePlain}
                  />
                </View>
                <View
                  className="min-w-0 flex-1"
                  style={{ paddingTop: PROFILE_BANNER_OVERLAP }}
                >
                  <DisplayNameWithBadges
                    text={displayName}
                    isVerified={profile.is_verified}
                    isBeta={profile.is_beta}
                    interactiveBadges
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    badgeSize="md"
                    className="font-serif-semibold text-xl text-foreground"
                  />
                  <Text
                    style={{ marginTop: -2 }}
                    className="font-mono text-xs text-muted-foreground"
                    numberOfLines={1}
                  >
                    @{profile.username}
                    {profile.location_name ? ` · ${profile.location_name}` : ""}
                  </Text>
                </View>
              </View>

              {!isSelf ? (
                <View className="absolute right-6 top-11 z-10 flex-row gap-2">
                  <FollowButton
                    status={status}
                    onPress={toggleFriend}
                    onSecondaryPress={declineRequest}
                    size="md"
                  />
                  <Pressable
                    onPress={() => setUserOptionsOpen(true)}
                    className="rounded-full border border-border bg-card/90 p-1.5 active:opacity-90"
                    accessibilityLabel="User options"
                  >
                    <MoreHorizontal size={18} color="#8a9e82" />
                  </Pressable>
                </View>
              ) : null}

              <View className="mt-2.5 flex-row items-start gap-3">
                <View className="min-w-0 flex-1">
                  {profile.bio ? (
                    <LinkableText className="font-sans text-sm leading-relaxed text-foreground/70">
                      {profile.bio}
                    </LinkableText>
                  ) : null}
                </View>
                <View className="shrink-0 items-end">
                  {showcaseSlots.some((slot) => slot !== null) ? (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/badges",
                          params: { userId: profileId, username: profile?.username ?? "" },
                        })
                      }
                      className="mb-2 flex-row items-center gap-3 px-2.5 active:opacity-70"
                      accessibilityRole="button"
                      accessibilityLabel="Displayed badges. View all badges."
                    >
                      {showcaseSlots.map((slot, index) =>
                        slot ? (
                          <View key={slot.id} className="w-12 items-center">
                            <BadgeShowcaseSlot badge={slot} small showLabel={false} />
                          </View>
                        ) : (
                          <View key={index} className="w-12" />
                        ),
                      )}
                    </Pressable>
                  ) : null}
                  <View className="overflow-hidden rounded-xl border border-border bg-card px-2.5 py-1">
                    <ProfileStatsRow stats={stats} variant="inline" />
                  </View>
                </View>
              </View>

            </View>

            {showProfilePet ? (
              <View
                pointerEvents="box-none"
                className="absolute left-0 right-0 top-0"
                style={{
                  height: PROFILE_BANNER_HEIGHT + 48,
                  zIndex: 20,
                  elevation: 20,
                }}
              >
                <PocketBirdPet
                  speciesId={resolveProfilePetSpeciesId(profile)}
                  hatId={resolveProfilePetHatId(profile)}
                  size={PROFILE_PET_SIZE}
                  arenaHeight={PROFILE_BANNER_HEIGHT}
                  interactive
                  soundEnabled={petSoundEnabled}
                  paused={reduceMotion}
                  grounded
                />
              </View>
            ) : null}
          </View>

          <View className={`mt-2 border-t border-border ${isPostsEmpty ? "flex-1" : ""}`}>
            <ProfilePostsFilterBar value={postsFilter} onChange={setPostsFilter} />
            {isPostsEmpty ? (
              <View className="flex-1 justify-between">
                <View className="px-4 pt-2">
                  <SightingPostsGrid
                    sightings={gridPosts}
                    emptyLabel={emptyPostsLabel}
                    onPressSighting={(sightingId) => router.push(`/post/${sightingId}`)}
                  />
                </View>
                <View className="px-4 pt-6">
                  <ProfileBadgesPreview
                    badges={badges}
                    earnedCount={earnedCount}
                    userId={profileId}
                    username={profile.username}
                    showcaseBadgeIds={profile.showcase_badge_ids}
                  />
                </View>
              </View>
            ) : (
              <>
                <View className="px-4 pt-2">
                  <SightingPostsGrid
                    sightings={gridPosts}
                    emptyLabel={emptyPostsLabel}
                    onPressSighting={(sightingId) => router.push(`/post/${sightingId}`)}
                  />
                </View>
                <View className="mt-8 px-4">
                  <ProfileBadgesPreview
                    badges={badges}
                    earnedCount={earnedCount}
                    userId={profileId}
                    username={profile.username}
                    showcaseBadgeIds={profile.showcase_badge_ids}
                  />
                </View>
              </>
            )}
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
          isAdmin={isAdmin}
          onModerate={() => setModerationOpen(true)}
        />
      ) : null}
    </SafeAreaView>
  );
}
