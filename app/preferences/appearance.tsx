import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LikeIcon } from "@/components/LikeIcon";
import { useLikeIconStyle } from "@/components/LikeIconStyleProvider";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsToggleRow } from "@/components/settings/SettingsToggleRow";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { getUserFacingMessage } from "@/lib/errors";
import { LIKE_ICON_STYLES } from "@/lib/likeIconStyle";
import { updateDistanceUnit } from "@/lib/profilePreferences";
import { updateProfilePetSettings } from "@/lib/profilePet";
import { DISTANCE_UNIT_OPTIONS, radiusOptionsForUnit } from "@/lib/units";
import type { DistanceUnit } from "@/types";

function LikePreview({ style }: { style: (typeof LIKE_ICON_STYLES)[number]["id"] }) {
  return (
    <View className="mx-4 mb-3 flex-row items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
      <View className="h-9 w-9 overflow-hidden rounded-lg bg-muted">
        <View className="h-full w-full bg-primary/20" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-serif text-sm text-foreground">American Robin</Text>
        <Text className="font-sans text-[11px] text-muted-foreground">Preview post</Text>
      </View>
      <LikeIcon liked={false} style={style} size={20} />
      <LikeIcon liked style={style} size={20} />
    </View>
  );
}

export default function AppearancePreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { profile, loading, setRadius, silentRefresh } = useProfile(userId);
  const { likeIconStyle, setLikeIconStyle } = useLikeIconStyle();
  const [savingLikeIcon, setSavingLikeIcon] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [savingProfilePet, setSavingProfilePet] = useState(false);

  const unit: DistanceUnit = profile?.distance_unit ?? "km";
  const profilePetEnabled = profile?.profile_pet_enabled !== false;
  const radiusOptions = radiusOptionsForUnit(unit);

  async function handleLikeIconChange(next: typeof likeIconStyle) {
    if (savingLikeIcon || next === likeIconStyle) return;
    setSavingLikeIcon(true);
    try {
      await setLikeIconStyle(next);
    } catch (e) {
      Alert.alert("Could not save", getUserFacingMessage(e));
    } finally {
      setSavingLikeIcon(false);
    }
  }

  async function handleUnitChange(next: DistanceUnit) {
    if (!userId || savingUnit || next === unit) return;
    setSavingUnit(true);
    try {
      await updateDistanceUnit(userId, next);
      await silentRefresh();
    } catch (e) {
      Alert.alert("Could not save", getUserFacingMessage(e));
    } finally {
      setSavingUnit(false);
    }
  }

  async function handleProfilePetToggle(next: boolean) {
    if (!userId || savingProfilePet || next === profilePetEnabled) return;
    setSavingProfilePet(true);
    try {
      await updateProfilePetSettings(userId, { profile_pet_enabled: next });
      await silentRefresh();
    } catch (e) {
      Alert.alert("Could not save", getUserFacingMessage(e));
    } finally {
      setSavingProfilePet(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Appearance" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        {loading && !profile ? (
          <ActivityIndicator className="mt-8" color="#5f9470" />
        ) : (
          <>
            <SettingsGroup
              title="Profile pet"
              footer="When enabled, your selected pocket bird hops around on your profile banner. Others can see it too."
            >
              <SettingsToggleRow
                label="Show pet on profile"
                detail="Display your pocket bird on your profile banner"
                value={profilePetEnabled}
                disabled={savingProfilePet}
                onValueChange={(next) => void handleProfilePetToggle(next)}
              />
            </SettingsGroup>

            <SettingsGroup
              title="Like button"
              footer="How likes appear for you across the app."
            >
              <LikePreview style={likeIconStyle} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2 px-3 pb-3"
              >
                {LIKE_ICON_STYLES.map((option) => {
                  const active = likeIconStyle === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => void handleLikeIconChange(option.id)}
                      disabled={savingLikeIcon}
                      className={`w-[72px] items-center rounded-xl border px-2 py-3 active:opacity-85 ${
                        active ? "border-primary bg-primary/15" : "border-border bg-background"
                      }`}
                    >
                      <LikeIcon liked={active} style={option.id} size={22} />
                      <Text
                        className={`mt-2 text-center font-sans text-[10px] ${
                          active ? "font-sans-medium text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </SettingsGroup>

            <SettingsGroup title="Distance units">
              <View className="flex-row gap-2 p-3">
                {DISTANCE_UNIT_OPTIONS.map((option) => {
                  const active = unit === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => void handleUnitChange(option.id)}
                      disabled={savingUnit}
                      className={`flex-1 items-center rounded-xl border py-2.5 ${
                        active ? "border-primary bg-primary" : "border-border bg-background"
                      }`}
                    >
                      <Text
                        className={`font-sans-medium text-sm ${
                          active ? "text-primary-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SettingsGroup>

            <SettingsGroup
              title="Nearby radius"
              footer="Show sightings within this distance on your Nearby feed."
            >
              <View className="flex-row flex-wrap gap-2 p-3">
                {radiusOptions.map(({ km, label }) => {
                  const active = profile?.search_radius_km === km;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => void setRadius(km)}
                      className={`rounded-full border px-3 py-2 ${
                        active ? "border-primary bg-primary" : "border-border bg-background"
                      }`}
                    >
                      <Text
                        className={`font-mono text-xs ${
                          active ? "text-primary-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SettingsGroup>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
