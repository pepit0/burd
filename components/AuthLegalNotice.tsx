import { Text, View } from "react-native";
import { Linking } from "react-native";
import {
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from "@/lib/legalUrls";

export function AuthLegalNotice({ className }: { className?: string }) {
  return (
    <View className={className}>
      <Text className="text-center font-sans text-xs leading-relaxed text-muted-foreground">
        By continuing, you agree to our{" "}
        <Text
          className="text-primary"
          onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
          accessibilityRole="link"
        >
          Terms of Service
        </Text>{" "}
        and{" "}
        <Text
          className="text-primary"
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          accessibilityRole="link"
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}
