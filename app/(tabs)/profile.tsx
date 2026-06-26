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
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Camera,
  Check,
  ChevronRight,
  Feather,
  LogOut,
  MapPin,
  Star,
  Users,
} from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/hooks/useAuth";
import { useMySightings } from "@/hooks/useMySightings";
import { useProfile } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

const COVER =
  "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=200&fit=crop&auto=format";

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { profile, followers, following, loading, refreshing, error, refresh, silentRefresh, setRadius, updateAvatar } =
    useProfile(userId);
  const [avatarUploading, setAvatarUploading] = useState(false);
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
    () => sightings.filter((s) => s.photo_url).length,
    [sightings],
  );
  const rareCount = useMemo(
    () => sightings.filter((s) => s.rarity === "rare").length,
    [sightings],
  );

  const recent = sightings.slice(0, 5);

  const badges = useMemo(
    () => [
      { label: "First Flight", desc: "Logged your first sighting", earned: sightings.length >= 1 },
      { label: "Shutterbug", desc: "Added a photo to a sighting", earned: photoCount >= 1 },
      { label: "Rare Find", desc: "Spotted a rare bird", earned: rareCount >= 1 },
      { label: "Prolific Birder", desc: "Logged 10+ sightings", earned: sightings.length >= 10 },
      { label: "Social Flyer", desc: "Followed another birder", earned: following >= 1 },
    ],
    [sightings.length, photoCount, rareCount, following],
  );

  const displayName = profile?.full_name || profile?.username || "Birder";
  const stats = [
    { label: "Sightings", value: sightings.length },
    { label: "Species", value: speciesCount },
    { label: "Followers", value: followers },
    { label: "Following", value: following },
  ];

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
      <ScreenHeader title="Profile" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-12"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor="#5f9470" />
        }
      >
        <View className="h-28 bg-muted">
          <Image source={{ uri: COVER }} className="h-full w-full" resizeMode="cover" />
          <LinearGradient
            colors={["transparent", "rgba(24,30,22,0.8)"]}
            className="absolute inset-0"
          />
        </View>

        <View className="-mt-9 px-4">
          <Pressable
            onPress={() => void pickProfilePhoto()}
            disabled={avatarUploading}
            className="relative mb-3 h-[72px] w-[72px] active:opacity-90"
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
                    {displayName.charAt(0).toUpperCase()}
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

          <Text className="font-serif-semibold text-xl text-foreground">{displayName}</Text>
          <Text className="mt-0.5 font-mono text-xs text-muted-foreground">
            @{profile?.username ?? "birder"}
            {profile?.location_name ? ` · ${profile.location_name}` : ""}
          </Text>
          {profile?.bio ? (
            <Text className="mt-2.5 font-sans text-sm leading-relaxed text-foreground/70">
              {profile.bio}
            </Text>
          ) : null}

          <View className="mt-4 flex-row gap-2">
            {stats.map((s) => (
              <View
                key={s.label}
                className="flex-1 items-center rounded-xl border border-border bg-card p-2.5"
              >
                <Text className="font-serif-semibold text-lg leading-none text-foreground">
                  {s.value}
                </Text>
                <Text className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </Text>
              </View>
            ))}
          </View>

          {error ? (
            <Text className="mt-3 font-sans text-xs text-destructive">{error}</Text>
          ) : null}

          <View className="mt-6">
            <Text className="mb-1 font-serif-semibold text-base text-foreground">
              Nearby Radius
            </Text>
            <Text className="mb-3 font-sans text-xs text-muted-foreground">
              Show sightings within this distance on your Nearby feed.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {RADIUS_OPTIONS.map((km) => {
                const active = profile?.search_radius_km === km;
                return (
                  <Pressable
                    key={km}
                    onPress={() => setRadius(km)}
                    className={`rounded-full border px-4 py-2 ${
                      active ? "border-primary bg-primary" : "border-border bg-card"
                    }`}
                  >
                    <Text
                      className={`font-mono text-xs ${
                        active ? "text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {km} km
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={() => router.push("/users")}
            className="mt-4 flex-row items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 active:opacity-90"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/20">
                <Users size={16} color="#5f9470" />
              </View>
              <View>
                <Text className="font-sans-medium text-sm text-foreground">
                  Find birders
                </Text>
                <Text className="font-sans text-[11px] text-muted-foreground">
                  Follow others to fill your feed and like their posts
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color="#8a9e82" />
          </Pressable>

          <View className="mt-6">
            <Text className="mb-3 font-serif-semibold text-base text-foreground">
              Recent Sightings
            </Text>
            {recent.length === 0 ? (
              <Text className="font-sans text-sm text-muted-foreground">
                Nothing logged yet.
              </Text>
            ) : (
              <View className="gap-2">
                {recent.map((e) => (
                  <Pressable
                    key={e.id}
                    className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {e.photo_url ? (
                        <Image
                          source={{ uri: e.photo_url }}
                          className="h-full w-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <Feather size={15} color="#3a4e35" />
                      )}
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-serif text-sm text-foreground" numberOfLines={1}>
                        {e.species}
                      </Text>
                      <View className="mt-0.5 flex-row items-center gap-1">
                        <MapPin size={9} color="#8a9e82" />
                        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                          {e.location_name ?? "Unknown location"}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={13} color="#8a9e82" />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View className="mt-6">
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

          <Pressable
            onPress={() => supabase.auth.signOut()}
            className="mt-6 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 active:opacity-80"
          >
            <LogOut size={15} color="#8a9e82" />
            <Text className="font-sans-medium text-sm text-muted-foreground">Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
