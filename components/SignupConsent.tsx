import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Linking } from "react-native";
import { Check } from "lucide-react-native";
import {
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from "@/lib/legalUrls";

function ConsentCheckbox({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="mb-3 flex-row items-start gap-3 active:opacity-90"
      onPress={onToggle}
    >
      <View
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded-md border ${
          checked ? "border-primary bg-primary" : "border-border bg-card"
        }`}
      >
        {checked ? <Check size={14} color="#f0ead6" strokeWidth={3} /> : null}
      </View>
      <Text className="flex-1 font-sans text-sm leading-relaxed text-muted-foreground">
        {children}
      </Text>
    </Pressable>
  );
}

export interface SignupConsentProps {
  privacyAccepted: boolean;
  ageConfirmed: boolean;
  onPrivacyAcceptedChange: (accepted: boolean) => void;
  onAgeConfirmedChange: (confirmed: boolean) => void;
  className?: string;
}

export function SignupConsent({
  privacyAccepted,
  ageConfirmed,
  onPrivacyAcceptedChange,
  onAgeConfirmedChange,
  className,
}: SignupConsentProps) {
  return (
    <View className={className}>
      <ConsentCheckbox
        checked={privacyAccepted}
        onToggle={() => onPrivacyAcceptedChange(!privacyAccepted)}
      >
        I agree to the{" "}
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
      </ConsentCheckbox>

      <ConsentCheckbox
        checked={ageConfirmed}
        onToggle={() => onAgeConfirmedChange(!ageConfirmed)}
      >
        I confirm that I am at least 13 years old.
      </ConsentCheckbox>
    </View>
  );
}

export function hasSignupConsent(
  privacyAccepted: boolean,
  ageConfirmed: boolean,
): boolean {
  return privacyAccepted && ageConfirmed;
}

/** Shown near Apple/Google on sign-up — tapping those buttons counts as agreement. */
export function SignupSocialNotice({ className }: { className?: string }) {
  return (
    <Text
      className={`font-sans text-xs leading-relaxed text-muted-foreground ${className ?? ""}`}
    >
      By continuing with Apple or Google, you agree to our{" "}
      <Text
        className="text-primary"
        onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
        accessibilityRole="link"
      >
        Terms
      </Text>{" "}
      and{" "}
      <Text
        className="text-primary"
        onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
        accessibilityRole="link"
      >
        Privacy Policy
      </Text>
      , and confirm you are at least 13 years old.
    </Text>
  );
}
