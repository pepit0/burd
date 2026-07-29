import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Shield } from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsToggleRow } from "@/components/settings/SettingsToggleRow";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { getUserFacingMessage } from "@/lib/errors";
import {
  FUZZ_KM_OPTIONS,
  VISIBILITY_OPTIONS,
  fuzzKmLabel,
} from "@/lib/privacySettings";
import { updatePrivacySettings } from "@/lib/profilePreferences";
import { SENSITIVE_SPECIES_COUNT } from "@/lib/sensitiveSpecies";
import type { SightingVisibility } from "@/types";

export default function PrivacyPreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { profile, loading, silentRefresh } = useProfile(userId);
  const [saving, setSaving] = useState(false);

  const visibility = profile?.default_sighting_visibility ?? "public";
  const shareExact = profile?.share_exact_coordinates ?? false;
  const fuzzKm = profile?.location_fuzz_km ?? 1;
  const unit = profile?.distance_unit ?? "km";

  async function save(fields: Parameters<typeof updatePrivacySettings>[1]) {
    if (!userId || saving) return;
    setSaving(true);
    try {
      await updatePrivacySettings(userId, fields);
      await silentRefresh();
    } catch (e) {
      Alert.alert("Could not save", getUserFacingMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Privacy" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        {loading && !profile ? (
          <ActivityIndicator className="mt-8" color="#5f9470" />
        ) : (
          <>
            <SettingsGroup
              title="Who can see my sightings"
              footer="Default for new posts. You can override per sighting when sharing."
            >
              {VISIBILITY_OPTIONS.map((option, index) => {
                const active = visibility === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() =>
                      void save({ default_sighting_visibility: option.id as SightingVisibility })
                    }
                    disabled={saving}
                    className={`px-4 py-3.5 active:bg-card/80 ${
                      index > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="min-w-0 flex-1 pr-3">
                        <Text
                          className={`font-sans-medium text-sm ${
                            active ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {option.label}
                        </Text>
                        <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
                          {option.desc}
                        </Text>
                      </View>
                      {active ? (
                        <View className="h-2 w-2 rounded-full bg-primary" />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </SettingsGroup>

            <SettingsGroup
              title="Location on posts"
              footer="Even with exact coordinates enabled, only you see the precise pin. Others see an obscured area."
            >
              <SettingsToggleRow
                label="Attach exact coordinates"
                detail="Store precise GPS on your sighting (hidden from others)"
                value={shareExact}
                onValueChange={(next) => void save({ share_exact_coordinates: next })}
              />
            </SettingsGroup>

            <SettingsGroup
              title="Location fuzzing"
              footer="How precisely others can see where a sighting occurred. Lower = more private."
            >
              <View className="flex-row flex-wrap gap-2 p-3">
                {FUZZ_KM_OPTIONS.map((km) => {
                  const active = fuzzKm === km;
                  return (
                    <Pressable
                      key={km}
                      onPress={() => void save({ location_fuzz_km: km })}
                      disabled={saving}
                      className={`rounded-full border px-3 py-2 ${
                        active ? "border-primary bg-primary" : "border-border bg-background"
                      }`}
                    >
                      <Text
                        className={`font-mono text-xs ${
                          active ? "text-primary-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {fuzzKmLabel(km, unit)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SettingsGroup>

            <SettingsGroup title="Sensitive species">
              <View className="flex-row gap-3 px-4 py-4">
                <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-accent/15">
                  <Shield size={15} color="#c8893a" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-sans-medium text-sm text-foreground">
                    Automatic location protection
                  </Text>
                  <Text className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
                    Rare and at-risk species ({SENSITIVE_SPECIES_COUNT} on our list) have locations
                    automatically obscured regardless of your settings — following eBird and
                    iNaturalist conservation practice.
                  </Text>
                </View>
              </View>
            </SettingsGroup>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
