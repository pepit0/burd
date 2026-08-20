import { useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import RevenueCatUI from "react-native-purchases-ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useSubscription } from "@/hooks/useSubscription";
import { BURD_PRO_ENABLED } from "@/lib/burdProEnabled";

export default function CustomerCenterScreen() {
  const router = useRouter();
  const { supported, refresh } = useSubscription();

  useEffect(() => {
    if (!BURD_PRO_ENABLED) {
      router.back();
    }
  }, [router]);

  if (!BURD_PRO_ENABLED) {
    return null;
  }

  if (!supported) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <ScreenHeader title="Manage subscription" onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      {Platform.OS === "ios" ? (
        <ScreenHeader title="Manage subscription" onBack={() => router.back()} />
      ) : null}
      <View className="flex-1">
        <RevenueCatUI.CustomerCenterView
          style={{ flex: 1 }}
          shouldShowCloseButton={Platform.OS !== "ios"}
          onDismiss={() => router.back()}
          onRestoreCompleted={() => {
            void refresh();
          }}
        />
      </View>
    </SafeAreaView>
  );
}
