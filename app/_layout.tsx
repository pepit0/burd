import "react-native-gesture-handler";
import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { vars } from "nativewind";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_500Medium,
  Lora_600SemiBold,
  Lora_700Bold,
} from "@expo-google-fonts/lora";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import { SuspensionScreen } from "@/components/SuspensionScreen";
import { NotificationBadgeProvider } from "@/components/NotificationBadgeProvider";
import { SafeKeyboardProvider } from "@/components/SafeKeyboardProvider";
import { ColorThemeProvider, useColorTheme } from "@/components/ColorThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { nativewindColorVars } from "@/lib/colorTheme";
import { getMyAccountStatus } from "@/lib/moderation";
import { initRegionalCommunity } from "@/lib/regionalCommunity";
import type { AccountStatus } from "@/types";

function AppShell() {
  const { user } = useAuth();
  const { palette } = useColorTheme();
  usePushNotifications(user?.id ?? null);

  return (
    <NotificationBadgeProvider userId={user?.id ?? null}>
      <View className="flex-1 bg-background" style={vars(nativewindColorVars(palette))}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.background },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="notifications" options={{ presentation: "modal" }} />
          <Stack.Screen name="new-sighting" options={{ presentation: "modal" }} />
          <Stack.Screen name="sound-review" options={{ presentation: "modal" }} />
          <Stack.Screen name="sounds" />
          <Stack.Screen name="post/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="sighting/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="species/[id]" />
          <Stack.Screen name="users" />
          <Stack.Screen name="follows" />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="profile-settings" />
          <Stack.Screen
            name="camera"
            options={{ presentation: "fullScreenModal", animation: "fade" }}
          />
          <Stack.Screen
            name="audio-id"
            options={{ presentation: "fullScreenModal", animation: "fade" }}
          />
          <Stack.Screen name="data-sources" />
        </Stack>
      </View>
    </NotificationBadgeProvider>
  );
}

export default function RootLayout() {
  return (
    <ColorThemeProvider>
      <RootLayoutInner />
    </ColorThemeProvider>
  );
}

function RootLayoutInner() {
  const { session, loading, user } = useAuth();
  const { palette } = useColorTheme();
  const segments = useSegments();
  const router = useRouter();
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  const fontsReady =
    Platform.OS === "web" || fontsLoaded || Boolean(fontError);

  useEffect(() => {
    initRegionalCommunity();
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)/");
    }
  }, [session, loading, segments, router]);

  useEffect(() => {
    if (!user?.id || !session) {
      setAccountStatus(null);
      setStatusLoading(false);
      return;
    }

    let cancelled = false;
    setStatusLoading(true);
    getMyAccountStatus(user.id)
      .then((status) => {
        if (!cancelled) setAccountStatus(status);
      })
      .catch(() => {
        if (!cancelled) {
          setAccountStatus({
            role: "user",
            suspended: false,
            suspendedUntil: null,
            suspensionReason: null,
            isSuspended: false,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, session]);

  if (loading || !fontsReady || (session && statusLoading && !accountStatus)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (session && accountStatus?.isSuspended) {
    return (
      <SafeKeyboardProvider>
        <SuspensionScreen
          reason={accountStatus.suspensionReason}
          suspendedUntil={accountStatus.suspendedUntil}
        />
      </SafeKeyboardProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeKeyboardProvider>
        <AppShell />
      </SafeKeyboardProvider>
    </GestureHandlerRootView>
  );
}
