import "../global.css";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
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
import { useAuth } from "@/hooks/useAuth";
import { NotificationBadgeProvider } from "@/components/NotificationBadgeProvider";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { SafeKeyboardProvider } from "@/components/SafeKeyboardProvider";

function AppShell() {
  const { user } = useAuth();
  usePushNotifications(user?.id ?? null);

  return (
    <NotificationBadgeProvider userId={user?.id ?? null}>
      <View className="flex-1 bg-background">
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#181e16" },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="notifications" options={{ presentation: "modal" }} />
          <Stack.Screen name="new-sighting" options={{ presentation: "modal" }} />
          <Stack.Screen name="post/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="sighting/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="species/[id]" />
          <Stack.Screen name="users" />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen
            name="camera"
            options={{ presentation: "fullScreenModal", animation: "fade" }}
          />
          <Stack.Screen
            name="audio-id"
            options={{ presentation: "modal" }}
          />
        </Stack>
      </View>
    </NotificationBadgeProvider>
  );
}

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
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

  if (loading || !fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#5f9470" />
      </View>
    );
  }

  return (
    <SafeKeyboardProvider>
      <AppShell />
    </SafeKeyboardProvider>
  );
}
