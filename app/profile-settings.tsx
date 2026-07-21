import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColorTheme } from "@/components/ColorThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { deleteAccount } from "@/lib/accountDeletion";
import { getUserFacingMessage } from "@/lib/errors";

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { profile, loading, setRadius } = useProfile(userId);
  const { mode, setMode, palette } = useColorTheme();
  const colorblindEnabled = mode === "colorblind";
  const [deleting, setDeleting] = useState(false);

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your profile, sightings, photos, audio, and other data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "Your account and all associated content will be permanently removed.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete forever",
                  style: "destructive",
                  onPress: () => void handleDeleteAccount(),
                },
              ],
            );
          },
        },
      ],
    );
  }

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteAccount();
      router.replace("/(auth)/login");
    } catch (e) {
      Alert.alert(
        "Could not delete account",
        getUserFacingMessage(e, "Please try again or contact support."),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title="Profile settings" onBack={() => router.back()} />
      <View className="px-4 pt-5">
        <Text className="mb-1 font-serif-semibold text-base text-foreground">
          Accessibility
        </Text>
        <Text className="mb-3 font-sans text-xs text-muted-foreground">
          Improve contrast and use a colorblind-friendly palette.
        </Text>
        <Pressable
          onPress={() => void setMode(colorblindEnabled ? "default" : "colorblind")}
          className="mb-6 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3 active:opacity-85"
        >
          <View className="pr-4">
            <Text className="font-sans-medium text-sm text-foreground">Colorblind Mode</Text>
            <Text className="mt-1 font-sans text-xs text-muted-foreground">
              Replace green-forward colors with a blue/orange accessible palette.
            </Text>
          </View>
          <View
            className={`h-6 w-11 rounded-full border ${
              colorblindEnabled ? "border-primary bg-primary" : "border-border bg-muted"
            }`}
          >
            <View
              className={`mt-0.5 h-5 w-5 rounded-full bg-primary-foreground ${
                colorblindEnabled ? "ml-5" : "ml-0.5"
              }`}
            />
          </View>
        </Pressable>

        <Text className="mb-1 font-serif-semibold text-base text-foreground">
          Nearby Radius
        </Text>
        <Text className="mb-4 font-sans text-xs text-muted-foreground">
          Show sightings within this distance on your Nearby feed.
        </Text>

        {loading && !profile ? (
          <ActivityIndicator className="mt-6" color={palette.primary} />
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {RADIUS_OPTIONS.map((km) => {
              const active = profile?.search_radius_km === km;
              return (
                <Pressable
                  key={km}
                  onPress={() => void setRadius(km)}
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
        )}

        <Text className="mb-1 mt-8 font-serif-semibold text-base text-foreground">
          Account
        </Text>
        <Text className="mb-3 font-sans text-xs text-muted-foreground">
          Permanently remove your Burd account and all associated data.
        </Text>
        <Pressable
          onPress={confirmDeleteAccount}
          disabled={deleting}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3.5 active:opacity-85"
        >
          {deleting ? (
            <ActivityIndicator color="#c8693a" />
          ) : (
            <>
              <Trash2 size={16} color="#c8693a" />
              <Text className="font-sans-medium text-sm text-destructive">
                Delete account
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

