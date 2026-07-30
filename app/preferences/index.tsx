import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";

export default function PreferencesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Preferences" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        <SettingsGroup title="Settings">
          <SettingsRow
            label="Account"
            detail="Profile, email, sign out"
            onPress={() => router.push("/preferences/account")}
          />
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
