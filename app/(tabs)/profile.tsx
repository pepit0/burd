import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ChevronRight,
  Database,
  FileText,
  Mail,
  Pencil,
  Settings,
  ShieldAlert,
  Shield,
  Users,
} from "lucide-react-native";
import { Linking } from "react-native";
import { ScrollScreen } from "@/components/ScrollScreen";
import {
  ProfileBannerPickerSheet,
} from "@/components/ProfileBannerPickerSheet";
import { ProfileBadgeShowcasePickerSheet } from "@/components/ProfileBadgeShowcasePickerSheet";
import { ProfileAvatarPeek } from "@/components/ProfileAvatarPeek";
import { ProfileBadgesPreview } from "@/components/ProfileBadges";
import { ProfileCoverWithPet } from "@/components/ProfileCoverWithPet";
import { ProfileDetailsEditSheet } from "@/components/ProfileDetailsEditSheet";
import {
  filterProfileSightings,
  ProfilePostsFilterBar,
  type ProfilePostsFilter,
} from "@/components/ProfilePostsFilter";
import { DisplayNameWithBadges } from "@/components/DisplayNameWithBadges";
import { UserBadgeAdminPanel } from "@/components/UserBadgeAdminPanel";
import { ProfileStatsRow } from "@/components/ProfileStatsRow";
import { LinkableText } from "@/components/LinkableText";
import { SightingPostsGrid } from "@/components/SightingPostsGrid";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useMySightings } from "@/hooks/useMySightings";
import { useProfileBadges } from "@/hooks/useProfileBadges";
import { useBadgeUnlockSync } from "@/hooks/useBadgeUnlockSync";
import { useReposts } from "@/hooks/useReposts";
import { useProfile } from "@/hooks/useProfile";
import { getUserFacingMessage } from "@/lib/errors";
import { hasCompletedUsernameSetup } from "@/lib/signup";
import { profileCoverPresetId, type ProfileCoverPresetId } from "@/lib/profileCover";
import { normalizeShowcaseBadgeIds } from "@/lib/profileShowcaseBadges";
import { requestFieldGuideView } from "@/lib/navigationIntent";
import { postedDate } from "@/lib/sightingFormat";
import { getPetSoundEnabled } from "@/lib/pocketBird/petSoundStorage";
import {
  DEFAULT_PET,
  getPetSpeciesId,
  subscribePetSpeciesId,
} from "@/lib/pocketBird/petStorage";
import { NO_HAT_ID, type PocketBirdHatId } from "@/lib/pocketBird/hats";
import {
  getPetHatId,
  subscribePetHatId,
} from "@/lib/pocketBird/petHatStorage";
import { stripDisplayNameColorCodes } from "@/lib/displayNameColors";
import {
  PRIVACY_POLICY_URL,
  SUPPORT_MAILTO,
  TERMS_OF_SERVICE_URL,
} from "@/lib/legalUrls";


function SettingsRow({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  description,
  onPress,
  borderTop = false,
}: {
  icon: typeof Users;
  iconColor: string;
  iconBg: string;
  label: string;
  description?: string;
  onPress: () => void;
  borderTop?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-card/80 ${
        borderTop ? "border-t border-border" : ""
      }`}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
      >
        <Icon size={15} color={iconColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-sm text-foreground">{label}</Text>
        {description ? (
          <Text className="mt-0.5 font-sans text-[11px] text-muted-foreground">
            {description}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={15} color="#8a9e82" />
    </Pressable>
  );
}

function LegalLinksRow({
  onTerms,
  onPrivacy,
  onDataSources,
}: {
  onTerms: () => void;
  onPrivacy: () => void;
  onDataSources: () => void;
}) {
  const links = [
    { label: "Terms", icon: FileText, onPress: onTerms },
    { label: "Privacy", icon: FileText, onPress: onPrivacy },
    { label: "Data", icon: Database, onPress: onDataSources },
  ] as const;

  return (
    <View className="flex-row gap-2 border-t border-border px-3 py-3">
      {links.map(({ label, icon: Icon, onPress }) => (
        <Pressable
          key={label}
          onPress={onPress}
          className="min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background/50 px-2 py-2.5 active:bg-card/80"
        >
          <Icon size={14} color="#8a9e82" />
          <Text className="font-sans-medium text-[11px] text-foreground">{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin } = useAdmin(userId);

  const { profile, friends, loading, refreshing, error, refresh, silentRefresh, updateAvatar, updateDetails, updateShowcaseBadges } =
    useProfile(userId);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerPickerOpen, setBannerPickerOpen] = useState(false);
  const [badgeShowcasePickerOpen, setBadgeShowcasePickerOpen] = useState(false);
  const [detailsEditOpen, setDetailsEditOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [petSoundEnabled, setPetSoundEnabled] = useState(false);
  const [petSpeciesId, setPetSpeciesId] = useState(DEFAULT_PET);
  const [petHatId, setPetHatId] = useState<PocketBirdHatId>(NO_HAT_ID);
  const [postsFilter, setPostsFilter] = useState<ProfilePostsFilter>("all");
  const { sightings, refresh: refreshSightings, silentRefresh: silentRefreshSightings } =
    useMySightings(userId);
  const { reposts, refresh: refreshReposts } = useReposts(userId);

  const firstFocus = useRef(true);

  useEffect(() => {
    if (loading || profile || !user) return;
    if (!hasCompletedUsernameSetup(user.user_metadata)) {
      router.replace("/(auth)/choose-username");
    }
  }, [loading, profile, router, user]);

  useEffect(() => {
    let cancelled = false;
    void getPetSoundEnabled().then((enabled) => {
      if (!cancelled) setPetSoundEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getPetSpeciesId().then((id) => {
      if (!cancelled) setPetSpeciesId(id);
    });
    const unsubscribe = subscribePetSpeciesId((id) => {
      if (!cancelled) setPetSpeciesId(id);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getPetHatId().then((id) => {
      if (!cancelled) setPetHatId(id);
    });
    const unsubscribe = subscribePetHatId((id) => {
      if (!cancelled) setPetHatId(id);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void getPetSpeciesId().then(setPetSpeciesId);
      void getPetHatId().then(setPetHatId);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      silentRefresh();
      silentRefreshSightings();
      void refreshReposts();
    }, [silentRefresh, silentRefreshSightings, refreshReposts]),
  );

  const onPullRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshSightings(), refreshReposts()]);
  }, [refresh, refreshSightings, refreshReposts]);

  const speciesCount = useMemo(
    () => new Set(sightings.map((s) => s.species.toLowerCase())).size,
    [sightings],
  );
  const { badges, earnedCount, loadingExtras } = useProfileBadges(userId, sightings, friends);
  useBadgeUnlockSync(Boolean(userId), badges, !loadingExtras);

  const publishedSightings = useMemo(
    () =>
      sightings
        .filter((s) => s.published_at)
        .sort((a, b) => postedDate(b).getTime() - postedDate(a).getTime()),
    [sightings],
  );
  const filteredPosts = useMemo(
    () => filterProfileSightings(publishedSightings, postsFilter),
    [publishedSightings, postsFilter],
  );
  const gridPosts = postsFilter === "reposts" ? reposts : filteredPosts;

  const displayName = profile?.full_name || profile?.username || "Birder";
  const displayNamePlain = stripDisplayNameColorCodes(displayName);
  const selectedCoverId = profileCoverPresetId(profile?.cover_url);

  const stats: {
    label: string;
    value: number;
    onPress: () => void;
  }[] = [
    { label: "Posts", value: publishedSightings.length, onPress: () => router.push("/(tabs)/journal") },
    {
      label: "Species",
      value: speciesCount,
      onPress: () => {
        requestFieldGuideView({ sortLoggedFirst: true });
        router.push("/(tabs)/field-guide");
      },
    },
    {
      label: "Friends",
      value: friends,
      onPress: () => router.push({ pathname: "/follows", params: { tab: "friends" } }),
    },
  ];

  async function saveProfileDetails(fullName: string, bio: string) {
    setProfileSaving(true);
    try {
      await updateDetails({
        full_name: fullName || null,
        bio: bio || null,
      });
      setDetailsEditOpen(false);
    } catch (e) {
      Alert.alert("Could not update profile", getUserFacingMessage(e));
    } finally {
      setProfileSaving(false);
    }
  }

  async function selectBanner(presetId: ProfileCoverPresetId) {
    if (presetId === selectedCoverId) {
      setBannerPickerOpen(false);
      return;
    }
    setProfileSaving(true);
    try {
      await updateDetails({ cover_url: presetId });
      setBannerPickerOpen(false);
    } catch (e) {
      Alert.alert("Could not update banner", getUserFacingMessage(e));
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveShowcaseBadges(badgeIds: string[]) {
    setProfileSaving(true);
    try {
      await updateShowcaseBadges(badgeIds);
    } catch (e) {
      Alert.alert("Could not update badges", getUserFacingMessage(e));
    } finally {
      setProfileSaving(false);
    }
  }

  async function pickProfilePhoto() {
    if (!userId || avatarUploading) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access to choose a profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets[0]?.base64) return;

    setAvatarUploading(true);
    try {
      await updateAvatar(result.assets[0].base64, "jpg");
    } catch (e) {
      Alert.alert("Could not update photo", getUserFacingMessage(e));
    } finally {
      setAvatarUploading(false);
    }
  }

  if (loading && !profile) {
    return (
      <ScrollScreen title="Profile">
        <ActivityIndicator className="mt-20" color="#5f9470" />
      </ScrollScreen>
    );
  }

  if (!profile && user && !hasCompletedUsernameSetup(user.user_metadata)) {
    return (
      <ScrollScreen title="Profile">
        <ActivityIndicator className="mt-20" color="#5f9470" />
      </ScrollScreen>
    );
  }

  const settingsAction = (
    <Pressable
      onPress={() => router.push("/preferences" as never)}
      className="rounded-full p-2 active:bg-card"
      accessibilityLabel="Profile settings"
    >
      <Settings size={18} color="#8a9e82" />
    </Pressable>
  );

  return (
    <>
      <ScrollScreen
        title="Profile"
        headerAction={settingsAction}
        contentClassName="pb-36"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor="#5f9470" />
        }
      >
        <ProfileCoverWithPet
          coverUrl={profile?.cover_url}
          profile={profile}
          speciesIdOverride={petSpeciesId}
          hatIdOverride={petHatId}
          editable
          interactive
          soundEnabled={petSoundEnabled}
          onPress={() => setBannerPickerOpen(true)}
        />

        <View className="-mt-9 px-4">
          <View className="mb-3 flex-row items-end gap-3">
            <ProfileAvatarPeek
              avatarUrl={profile?.avatar_url}
              avatarColor={profile?.avatar_color ?? "#5f9470"}
              displayName={displayNamePlain}
              editable
              uploading={avatarUploading}
              onPress={() => void pickProfilePhoto()}
            />
          </View>

          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-1.5">
                <View className="min-w-0 flex-1 shrink">
                  <DisplayNameWithBadges
                    text={displayName}
                    isVerified={profile?.is_verified}
                    isBeta={profile?.is_beta}
                    interactiveBadges
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    className="font-serif-semibold text-xl text-foreground"
                  />
                </View>
                <Pressable
                  onPress={() => setDetailsEditOpen(true)}
                  className="shrink-0 rounded-full p-1 active:bg-muted"
                  accessibilityLabel="Edit display name and bio"
                >
                  <Pencil size={14} color="#8a9e82" />
                </Pressable>
              </View>
              <Text className="mt-0.5 font-mono text-xs text-muted-foreground">
                @{profile?.username ?? "birder"}
                {profile?.location_name ? ` · ${profile.location_name}` : ""}
              </Text>
            </View>
            <View className="mr-2">
              <ProfileStatsRow stats={stats} variant="inline" />
            </View>
          </View>
          {profile?.bio ? (
            <LinkableText className="mt-2.5 font-sans text-sm leading-relaxed text-foreground/70">
              {profile.bio}
            </LinkableText>
          ) : (
            <Text className="mt-2.5 font-sans text-sm text-muted-foreground/70">
              Add a short bio about your birding.
            </Text>
          )}

          {error ? (
            <Text className="mt-3 font-sans text-xs text-destructive">{error}</Text>
          ) : null}

        </View>

        <View className="mt-6 border-t border-border">
          <ProfilePostsFilterBar value={postsFilter} onChange={setPostsFilter} />
          <View className="px-4 pt-2">
            <SightingPostsGrid
              sightings={gridPosts}
              emptyLabel={
                postsFilter === "reposts"
                  ? "No reposts yet. Repost public posts you love from the home feed."
                  : postsFilter === "photos"
                  ? "No photo posts yet. Publish a sighting from your journal."
                  : postsFilter === "audio"
                    ? "No audio posts yet. Publish a sound sighting from your journal."
                    : "No posts yet. Publish a sighting from your journal."
              }
              onPressSighting={(sightingId) => router.push(`/post/${sightingId}`)}
            />
          </View>
        </View>

        <View className="mt-8 px-4">
          <ProfileBadgesPreview
            badges={badges}
            earnedCount={earnedCount}
            userId={userId!}
            username={profile?.username}
            showcaseBadgeIds={profile?.showcase_badge_ids}
            isSelf
            onEditShowcase={() => setBadgeShowcasePickerOpen(true)}
          />
        </View>

        <View className="mt-8 px-4">
          <Text className="mb-3 font-serif-semibold text-base text-foreground">More</Text>
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            <SettingsRow
              icon={Users}
              iconColor="#5f9470"
              iconBg="rgba(95,148,112,0.15)"
              label="Find birders"
              description="Follow others to fill your home feed"
              onPress={() => router.push("/users")}
            />
            {isAdmin && profile ? (
              <View className="border-t border-border px-4 py-3">
                <UserBadgeAdminPanel
                  profile={{
                    id: profile.id,
                    username: profile.username,
                    is_verified: profile.is_verified,
                    is_beta: profile.is_beta,
                  }}
                  onUpdated={() => void refresh()}
                />
              </View>
            ) : null}
            {isAdmin ? (
              <SettingsRow
                icon={ShieldAlert}
                iconColor="#c8893a"
                iconBg="rgba(200,137,58,0.15)"
                label="Admin"
                description="Reports, moderation, and access"
                onPress={() => router.push("/admin" as never)}
                borderTop
              />
            ) : null}
            <SettingsRow
              icon={Mail}
              iconColor="#5f9470"
              iconBg="rgba(95,148,112,0.15)"
              label="Support"
              description="Questions, bugs, or account help"
              onPress={() => Linking.openURL(SUPPORT_MAILTO)}
              borderTop
            />
            <SettingsRow
              icon={Shield}
              iconColor="#5f9470"
              iconBg="rgba(95,148,112,0.15)"
              label="Age rating"
              description="13+ required · social features"
              onPress={() => router.push("/age-rating" as never)}
              borderTop
            />
            <LegalLinksRow
              onTerms={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
              onPrivacy={() => Linking.openURL(PRIVACY_POLICY_URL)}
              onDataSources={() => router.push("/data-sources" as never)}
            />
          </View>
        </View>
      </ScrollScreen>

      <ProfileDetailsEditSheet
        visible={detailsEditOpen}
        fullName={profile?.full_name ?? ""}
        bio={profile?.bio ?? ""}
        saving={profileSaving}
        onClose={() => setDetailsEditOpen(false)}
        onSave={(fullName, bio) => void saveProfileDetails(fullName, bio)}
      />

      <ProfileBannerPickerSheet
        visible={bannerPickerOpen}
        selectedId={selectedCoverId}
        saving={profileSaving}
        onClose={() => setBannerPickerOpen(false)}
        onSelect={(presetId) => void selectBanner(presetId)}
      />

      <ProfileBadgeShowcasePickerSheet
        visible={badgeShowcasePickerOpen}
        badges={badges}
        selectedIds={normalizeShowcaseBadgeIds(profile?.showcase_badge_ids)}
        saving={profileSaving}
        onClose={() => setBadgeShowcasePickerOpen(false)}
        onSave={(ids) => void saveShowcaseBadges(ids)}
      />
    </>
  );
}
