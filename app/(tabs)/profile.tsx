import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Camera,
  Check,
  ChevronRight,
  Database,
  FileText,
  LogOut,
  Pencil,
  Settings,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react-native";
import { Linking } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  ProfileBannerPickerSheet,
} from "@/components/ProfileBannerPickerSheet";
import { ProfileCoverBanner } from "@/components/ProfileCoverBanner";
import { ProfileDetailsEditSheet } from "@/components/ProfileDetailsEditSheet";
import {
  filterProfileSightings,
  ProfilePostsFilterBar,
  type ProfilePostsFilter,
} from "@/components/ProfilePostsFilter";
import { DisplayNameText } from "@/components/DisplayNameText";
import { ProfileStatsRow } from "@/components/ProfileStatsRow";
import { SightingPostsGrid } from "@/components/SightingPostsGrid";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useMySightings } from "@/hooks/useMySightings";
import { useProfile } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";
import { profileCoverPresetId, type ProfileCoverPresetId } from "@/lib/profileCover";
import { requestFieldGuideView } from "@/lib/navigationIntent";
import { supabase } from "@/lib/supabase";
import { stripDisplayNameColorCodes } from "@/lib/displayNameColors";

const PRIVACY_POLICY_URL = "https://burdapp.com/privacy.html";

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

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin } = useAdmin(userId);

  const { profile, friends, loading, refreshing, error, refresh, silentRefresh, updateAvatar, updateDetails } =
    useProfile(userId);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerPickerOpen, setBannerPickerOpen] = useState(false);
  const [detailsEditOpen, setDetailsEditOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [postsFilter, setPostsFilter] = useState<ProfilePostsFilter>("all");
  const { sightings, refresh: refreshSightings, silentRefresh: silentRefreshSightings } =
    useMySightings(userId);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      silentRefresh();
      silentRefreshSightings();
    }, [silentRefresh, silentRefreshSightings]),
  );

  const onPullRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshSightings()]);
  }, [refresh, refreshSightings]);

  const speciesCount = useMemo(
    () => new Set(sightings.map((s) => s.species.toLowerCase())).size,
    [sightings],
  );
  const photoCount = useMemo(
    () => sightings.filter((s) => s.photo_url && !s.audio_url).length,
    [sightings],
  );
  const rareCount = useMemo(
    () => sightings.filter((s) => s.rarity === "rare").length,
    [sightings],
  );

  const publishedSightings = useMemo(
    () => sightings.filter((s) => s.published_at),
    [sightings],
  );
  const filteredPosts = useMemo(
    () => filterProfileSightings(publishedSightings, postsFilter),
    [publishedSightings, postsFilter],
  );

  const badges = useMemo(
    () => [
      { label: "First Flight", desc: "Logged your first sighting", earned: sightings.length >= 1 },
      { label: "Shutterbug", desc: "Added a photo to a sighting", earned: photoCount >= 1 },
      { label: "Rare Find", desc: "Spotted a rare bird", earned: rareCount >= 1 },
      { label: "Prolific Birder", desc: "Logged 10+ sightings", earned: sightings.length >= 10 },
      { label: "Social Flyer", desc: "Added another birder", earned: friends >= 1 },
    ],
    [sightings.length, photoCount, rareCount, friends],
  );

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
      Alert.alert("Could not update profile", getErrorMessage(e));
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
      Alert.alert("Could not update banner", getErrorMessage(e));
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
      Alert.alert("Could not update photo", getErrorMessage(e));
    } finally {
      setAvatarUploading(false);
    }
  }

  if (loading && !profile) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <ScreenHeader title="Profile" />
        <ActivityIndicator className="mt-20" color="#5f9470" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title="Profile"
        action={
          <Pressable
            onPress={() => router.push("/profile-settings" as never)}
            className="rounded-full p-2 active:bg-card"
            accessibilityLabel="Profile settings"
          >
            <Settings size={18} color="#8a9e82" />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-12"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor="#5f9470" />
        }
      >
        <ProfileCoverBanner
          coverUrl={profile?.cover_url}
          editable
          onPress={() => setBannerPickerOpen(true)}
        />

        <View className="-mt-9 px-4">
          <View className="mb-3 flex-row items-end gap-3">
            <Pressable
              onPress={() => void pickProfilePhoto()}
              disabled={avatarUploading}
              className="relative h-[72px] w-[72px] shrink-0 active:opacity-90"
            >
              <View
                className="h-full w-full overflow-hidden rounded-full border-[3px] border-background"
                style={{ backgroundColor: profile?.avatar_color ?? "#5f9470" }}
              >
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Text className="font-serif-semibold text-2xl text-primary-foreground">
                      {displayNamePlain.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {avatarUploading ? (
                  <View className="absolute inset-0 items-center justify-center bg-black/45">
                    <ActivityIndicator color="#f0ead6" />
                  </View>
                ) : null}
              </View>
              {!avatarUploading ? (
                <View
                  className="absolute -bottom-0.5 -right-0.5 z-10 h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm"
                  style={{ elevation: 4 }}
                >
                  <Camera size={13} color="#8a9e82" />
                </View>
              ) : null}
            </Pressable>
          </View>

          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-1.5">
                <DisplayNameText
                  text={displayName}
                  className="font-serif-semibold text-xl text-foreground"
                />
                <Pressable
                  onPress={() => setDetailsEditOpen(true)}
                  className="rounded-full p-1 active:bg-muted"
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
            <Text className="mt-2.5 font-sans text-sm leading-relaxed text-foreground/70">
              {profile.bio}
            </Text>
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
              sightings={filteredPosts}
              emptyLabel={
                postsFilter === "photos"
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
          <Text className="mb-3 font-serif-semibold text-base text-foreground">Badges</Text>
          <View className="gap-2">
            {badges.map((b) => (
              <View
                key={b.label}
                className={`flex-row items-center gap-3 rounded-xl border bg-card p-3 ${
                  b.earned ? "border-accent/30" : "border-border/30 opacity-50"
                }`}
              >
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    b.earned ? "bg-accent/20" : "bg-muted"
                  }`}
                >
                  <Star
                    size={15}
                    color={b.earned ? "#c8893a" : "#8a9e82"}
                    fill={b.earned ? "rgba(200,137,58,0.3)" : "transparent"}
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-serif text-sm text-foreground">{b.label}</Text>
                  <Text className="font-sans text-[11px] text-muted-foreground">{b.desc}</Text>
                </View>
                {b.earned && <Check size={13} color="#c8893a" />}
              </View>
            ))}
          </View>
        </View>

        <View className="mt-8 px-4">
          <Text className="mb-3 font-serif-semibold text-base text-foreground">More</Text>
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            <SettingsRow
              icon={Users}
              iconColor="#5f9470"
              iconBg="rgba(95,148,112,0.15)"
              label="Find birders"
              description="Follow others to fill your feed"
              onPress={() => router.push("/users")}
            />
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
              icon={FileText}
              iconColor="#8a9e82"
              iconBg="rgba(138,158,130,0.15)"
              label="Privacy Policy"
              description="How Burd collects and uses data"
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              borderTop
            />
            <SettingsRow
              icon={Database}
              iconColor="#8a9e82"
              iconBg="rgba(138,158,130,0.15)"
              label="Data sources"
              description="Regional frequency and attribution"
              onPress={() => router.push("/data-sources" as never)}
              borderTop
            />
            <Pressable
              onPress={() => supabase.auth.signOut()}
              className="flex-row items-center justify-center gap-2 border-t border-border px-4 py-3.5 active:bg-card/80"
            >
              <LogOut size={15} color="#8a9e82" />
              <Text className="font-sans-medium text-sm text-muted-foreground">Sign out</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

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
    </SafeAreaView>
  );
}
