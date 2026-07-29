import { useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsToggleRow } from "@/components/settings/SettingsToggleRow";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getUserFacingMessage } from "@/lib/errors";
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_PREF_LABELS,
  normalizeNotificationPrefs,
  updateNotificationPrefs,
} from "@/lib/notificationPrefs";
import type { NotificationPrefs } from "@/types";

export default function NotificationsPreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { profile, loading, refresh } = useProfile(userId);
  const { permissionGranted } = usePushNotifications(userId);
  const [saving, setSaving] = useState(false);

  const prefs = normalizeNotificationPrefs(profile?.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS);

  async function setPref(key: keyof NotificationPrefs, value: boolean) {
    if (!userId || saving) return;
    const next = { ...prefs, [key]: value };
    setSaving(true);
    try {
      await updateNotificationPrefs(userId, next);
      await refresh();
    } catch (e) {
      Alert.alert("Could not save", getUserFacingMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Notifications" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        {loading && !profile ? (
          <ActivityIndicator className="mt-8" color="#5f9470" />
        ) : (
          <>
            <SettingsGroup
              title="Push notifications"
              footer={
                permissionGranted
                  ? "Alerts are delivered via your device. Toggle types below."
                  : "Enable notifications in iOS Settings to receive push alerts."
              }
            >
              <SettingsToggleRow
                label="System notifications"
                detail={
                  permissionGranted
                    ? "Enabled on this device"
                    : "Tap to open Settings and enable"
                }
                value={permissionGranted}
                onValueChange={() => Linking.openSettings()}
              />
            </SettingsGroup>

            <SettingsGroup title="Alert types">
              {NOTIFICATION_PREF_LABELS.map((item, index) => (
                <SettingsToggleRow
                  key={item.key}
                  label={item.label}
                  detail={item.detail}
                  value={prefs[item.key]}
                  onValueChange={(next) => void setPref(item.key, next)}
                  borderTop={index > 0}
                  disabled={saving || item.key === "nearby_rare"}
                />
              ))}
            </SettingsGroup>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
