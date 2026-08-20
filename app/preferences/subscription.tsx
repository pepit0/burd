import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Crown } from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { useSubscription } from "@/hooks/useSubscription";
import { BURD_PRO_ENABLED } from "@/lib/burdProEnabled";
import { BURD_PRODUCT_IDS } from "@/lib/revenuecat";

function formatRenewalDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SubscriptionPreferencesScreen() {
  const router = useRouter();

  useEffect(() => {
    if (!BURD_PRO_ENABLED) {
      router.replace("/preferences");
    }
  }, [router]);

  if (!BURD_PRO_ENABLED) {
    return null;
  }

  return <SubscriptionPreferencesContent />;
}

function SubscriptionPreferencesContent() {
  const router = useRouter();
  const {
    supported,
    loading,
    error,
    isPro,
    proEntitlement,
    entitlementDisplayName,
    restore,
    showPaywall,
    refresh,
  } = useSubscription();
  const [actionLoading, setActionLoading] = useState(false);

  const runAction = useCallback(
    async (action: () => Promise<void>) => {
      setActionLoading(true);
      try {
        await action();
      } finally {
        setActionLoading(false);
      }
    },
    [],
  );

  const renewalLabel = formatRenewalDate(proEntitlement?.expirationDate ?? null);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Burd Pro" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        <View className="mb-4 items-center rounded-2xl border border-border bg-card px-4 py-6">
          <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-primary/15">
            <Crown size={28} color="#5f9470" />
          </View>
          <Text className="font-serif-semibold text-xl text-foreground">
            {entitlementDisplayName}
          </Text>
          <Text className="mt-2 text-center font-sans text-sm leading-relaxed text-muted-foreground">
            {isPro
              ? "Thanks for supporting Burd. Your Pro benefits are active on this account."
              : "Unlock Pro to support Burd and get access to premium features as they roll out."}
          </Text>
          {isPro ? (
            <View className="mt-4 rounded-full bg-primary/15 px-3 py-1">
              <Text className="font-sans-medium text-xs text-primary">Active</Text>
            </View>
          ) : null}
          {renewalLabel ? (
            <Text className="mt-3 font-sans text-xs text-muted-foreground">
              {proEntitlement?.willRenew ? "Renews" : "Expires"} {renewalLabel}
            </Text>
          ) : null}
        </View>

        {!supported ? (
          <SettingsGroup title="Availability">
            <SettingsRow
              label="Mobile app required"
              detail="Subscriptions are managed through the iOS and Android apps."
              showChevron={false}
            />
          </SettingsGroup>
        ) : (
          <>
            <SettingsGroup title="Plans">
              <SettingsRow
                label="Monthly"
                detail={`Product ID: ${BURD_PRODUCT_IDS.monthly}`}
                value={isPro ? "Included" : undefined}
                showChevron={false}
              />
              <SettingsRow
                label="Yearly"
                detail={`Product ID: ${BURD_PRODUCT_IDS.yearly}`}
                value={isPro ? "Included" : undefined}
                borderTop
                showChevron={false}
              />
            </SettingsGroup>

            <View className="mt-4 gap-3">
              {!isPro ? (
                <Pressable
                  disabled={actionLoading || loading}
                  onPress={() =>
                    void runAction(async () => {
                      const purchased = await showPaywall();
                      if (purchased) {
                        Alert.alert("Welcome to Burd Pro!", "Your subscription is now active.");
                      }
                    })
                  }
                  className="items-center rounded-xl bg-primary px-4 py-4 active:opacity-90 disabled:opacity-60"
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="font-sans-medium text-base text-primary-foreground">
                      View plans
                    </Text>
                  )}
                </Pressable>
              ) : null}

              <Pressable
                disabled={actionLoading || loading}
                onPress={() => router.push("/customer-center")}
                className="items-center rounded-xl border border-border bg-card px-4 py-4 active:bg-card/80 disabled:opacity-60"
              >
                <Text className="font-sans-medium text-base text-foreground">
                  Manage subscription
                </Text>
              </Pressable>

              <Pressable
                disabled={actionLoading || loading}
                onPress={() =>
                  void runAction(async () => {
                    const restored = await restore();
                    Alert.alert(
                      restored ? "Subscription restored" : "No subscription found",
                      restored
                        ? "Your Burd Pro access has been restored."
                        : "We couldn't find an active subscription for this store account.",
                    );
                  })
                }
                className="items-center rounded-xl px-4 py-3 active:opacity-70 disabled:opacity-60"
              >
                <Text className="font-sans-medium text-sm text-muted-foreground">
                  Restore purchases
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {error ? (
          <Text className="mt-4 font-sans text-sm text-destructive">{error}</Text>
        ) : null}

        {loading && supported ? (
          <View className="mt-4 items-center">
            <ActivityIndicator />
          </View>
        ) : null}

        {Platform.OS !== "web" && supported ? (
          <Pressable
            onPress={() => void refresh()}
            className="mt-6 items-center py-2 active:opacity-70"
          >
            <Text className="font-sans text-xs text-muted-foreground">Refresh status</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
