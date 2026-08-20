import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { PocketBirdPet } from "@/components/PocketBirdPet";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { DEFAULT_PET, getPetSpeciesId } from "@/lib/pocketBird/petStorage";
import { getPetHatId } from "@/lib/pocketBird/petHatStorage";
import { NO_HAT_ID, type PocketBirdHatId } from "@/lib/pocketBird/hats";
import { BURD_PRO_ENABLED } from "@/lib/burdProEnabled";

export default function PreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { profile } = useProfile(userId);

  const [petSpeciesId, setPetSpeciesId] = useState(DEFAULT_PET);
  const [petHatId, setPetHatId] = useState<PocketBirdHatId>(NO_HAT_ID);

  useEffect(() => {
    let cancelled = false;
    void getPetSpeciesId().then((id) => {
      if (!cancelled) setPetSpeciesId(id);
    });
    void getPetHatId().then((id) => {
      if (!cancelled) setPetHatId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const accountInitials = useMemo(() => {
    const name = profile?.username ?? "?";
    return (name[0] ?? "?").toUpperCase();
  }, [profile?.username]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Preferences" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        <SettingsGroup title="Settings">
          {BURD_PRO_ENABLED ? (
            <SettingsRow
              label="Burd Pro"
              detail="Subscription and premium features"
              onPress={() => router.push("/preferences/subscription")}
            />
          ) : null}
          <Pressable
            onPress={() => router.push("/preferences/account")}
            className={`flex-row items-center justify-between px-4 py-5 active:bg-card/80${
              BURD_PRO_ENABLED ? " border-t border-border" : ""
            }`}
          >
            <View className="flex-row items-center gap-3 flex-1 min-w-0">
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  className="h-12 w-12 rounded-full border-2 border-border"
                />
              ) : (
                <View
                  className="h-12 w-12 items-center justify-center rounded-full border-2 border-border"
                  style={{ backgroundColor: profile?.avatar_color ?? "#5f9470" }}
                >
                  <Text className="font-serif-semibold text-xl text-primary-foreground">
                    {accountInitials}
                  </Text>
                </View>
              )}

              <View className="min-w-0 flex-1 pr-2">
                <Text className="font-sans-medium text-sm text-foreground">
                  Account
                </Text>
                <Text className="mt-0.5 font-sans text-xs leading-relaxed text-muted-foreground">
                  Profile, email, sign out
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <View className="h-15 w-20 items-center justify-center -mt-4 -ml-2">
                <PocketBirdPet
                  speciesId={petSpeciesId}
                  hatId={petHatId}
                  size={70}
                  interactive={false}
                  paused
                  grounded
                  soundEnabled={false}
                />
              </View>
              <ChevronRight size={16} color="#8a9e82" />
            </View>
          </Pressable>
          <SettingsRow
            label="Privacy"
            detail="Sighting visibility and location"
            onPress={() => router.push("/preferences/privacy")}
            borderTop
          />
          <SettingsRow
            label="Blocked users"
            detail="Manage blocked accounts"
            onPress={() => router.push("/preferences/blocked-users")}
            borderTop
          />
          <SettingsRow
            label="Notifications"
            detail="Push alerts by type"
            onPress={() => router.push("/preferences/notifications")}
            borderTop
          />
          <SettingsRow
            label="Appearance"
            detail="Like button, units, nearby radius"
            onPress={() => router.push("/preferences/appearance")}
            borderTop
          />
          <SettingsRow
            label="Accessibility"
            detail="Color, motion, haptics"
            onPress={() => router.push("/preferences/accessibility")}
            borderTop
          />
          <SettingsRow
            label="About"
            detail="Version, bug report, legal"
            onPress={() => router.push("/preferences/about")}
            borderTop
          />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}
