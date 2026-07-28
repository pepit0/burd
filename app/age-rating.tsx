import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Linking } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  MINIMUM_AGE,
  SOCIAL_FEATURES,
} from "@/lib/ageRating";
import { PRIVACY_POLICY_URL, SUPPORT_MAILTO } from "@/lib/legalUrls";

export default function AgeRatingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title="Age rating" onBack={() => router.back()} />
      <ScrollView className="flex-1 px-4 pb-8" contentContainerClassName="gap-4">
        <View className="rounded-xl border border-border bg-card p-4">
          <Text className="font-serif-semibold text-lg text-foreground">
            Rated {MINIMUM_AGE}+
          </Text>
          <Text className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
            Burd is intended for users age {MINIMUM_AGE} and older. You must confirm that you
            meet this minimum age when creating an account.
          </Text>
        </View>

        <View className="rounded-xl border border-border bg-card p-4">
          <Text className="font-sans-medium text-sm text-foreground">
            Social features
          </Text>
          <Text className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
            Burd includes social media capabilities. These features let you interact with
            content shared by other birders:
          </Text>
          {SOCIAL_FEATURES.map((feature) => (
            <Text
              key={feature}
              className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground"
            >
              • {feature}
            </Text>
          ))}
        </View>

        <View className="rounded-xl border border-border bg-card p-4">
          <Text className="font-sans-medium text-sm text-foreground">
            Not for children under {MINIMUM_AGE}
          </Text>
          <Text className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
            Burd is not directed to children under {MINIMUM_AGE} (or a higher age where local
            law requires). We do not knowingly collect personal information from children
            under that age. If you believe a child has created an account or provided personal
            data, please contact us and we will take appropriate action.
          </Text>
        </View>

        <View className="rounded-xl border border-border bg-card p-4">
          <Text className="font-sans-medium text-sm text-foreground">More information</Text>
          <Pressable
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            className="mt-2 rounded-lg border border-border px-3 py-2.5 active:opacity-80"
          >
            <Text className="font-sans-medium text-sm text-foreground">Privacy Policy</Text>
            <Text className="mt-1 font-sans text-xs text-muted-foreground">
              How we handle personal data, including children's privacy.
            </Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(SUPPORT_MAILTO)}
            className="mt-2 rounded-lg border border-border px-3 py-2.5 active:opacity-80"
          >
            <Text className="font-sans-medium text-sm text-foreground">Contact support</Text>
            <Text className="mt-1 font-sans text-xs text-muted-foreground">
              Report an underage account or ask a question.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
