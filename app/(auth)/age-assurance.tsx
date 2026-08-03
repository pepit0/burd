import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, ShieldCheck } from "lucide-react-native";
import { SignupConsent, hasSignupConsent } from "@/components/SignupConsent";
import { useAuth } from "@/hooks/useAuth";
import { MINIMUM_AGE, SOCIAL_FEATURES } from "@/lib/ageRating";
import {
  ageAssuranceBlockedMetadata,
  ageAssuranceMetadataFromResult,
  isAgeAssuranceBlocked,
  isDeclaredAgeRangeNativeAvailable,
  recordSelfDeclaredAgeAssurance,
  verifyAgeForSocialMedia,
} from "@/lib/ageAssurance";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export default function AgeAssuranceScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const consentComplete = hasSignupConsent(privacyAccepted, ageConfirmed);
  const usesAppleAgeApi = isDeclaredAgeRangeNativeAvailable();

  useEffect(() => {
    if (isAgeAssuranceBlocked(user?.user_metadata ?? undefined)) {
      setBlocked(true);
    }
    if (!isDeclaredAgeRangeNativeAvailable()) {
      setShowFallback(true);
    }
  }, [user?.user_metadata]);

  async function persistMetadata(data: Record<string, string | boolean | number | null>) {
    const { error: updateError } = await supabase.auth.updateUser({ data });
    if (updateError) {
      throw updateError;
    }
  }

  async function handleVerifyWithApple() {
    setError(null);
    setLoading(true);
    try {
      const result = await verifyAgeForSocialMedia();
      if ("code" in result) {
        if (result.code === "under_minimum_age") {
          await persistMetadata(ageAssuranceBlockedMetadata());
          setBlocked(true);
          return;
        }
        setShowFallback(true);
        setError(result.message);
        return;
      }

      await persistMetadata(ageAssuranceMetadataFromResult(result));
      // Root layout reacts to updated user metadata.
    } catch (e) {
      setError(getUserFacingMessage(e, "Could not save age verification."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelfDeclaredContinue() {
    if (!consentComplete) {
      setError(
        `Please accept the Terms & Privacy Policy and confirm you are at least ${MINIMUM_AGE}.`,
      );
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = recordSelfDeclaredAgeAssurance();
      await persistMetadata({
        ...ageAssuranceMetadataFromResult(result),
        age_confirmed_at: result.verifiedAt,
        privacy_policy_accepted_at: result.verifiedAt,
      });
    } catch (e) {
      setError(getUserFacingMessage(e, "Could not save age confirmation."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (blocked) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center px-6">
          <View className="mb-6 items-center">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15">
              <Feather size={28} color="#ef4444" />
            </View>
            <Text className="mb-2 text-center font-serif-semibold text-2xl text-foreground">
              Not eligible yet
            </Text>
            <Text className="text-center font-sans text-base leading-relaxed text-muted-foreground">
              Burd&apos;s social features are for users age {MINIMUM_AGE} and older. You can still
              explore birding resources on{" "}
              <Text className="text-primary">burdapp.com</Text>.
            </Text>
          </View>
          <Pressable
            className="items-center rounded-xl border border-border bg-card py-3.5 active:opacity-90"
            onPress={() => void handleSignOut()}
          >
            <Text className="font-sans-medium text-base text-foreground">Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center px-6 py-8">
        <View className="mb-8 flex-row items-center gap-2.5">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Feather size={20} color="#f0ead6" />
          </View>
          <Text className="font-serif-semibold text-3xl tracking-tight text-foreground">
            Burd
          </Text>
        </View>

        <View className="mb-4 flex-row items-center gap-2">
          <ShieldCheck size={20} color="#5f9470" />
          <Text className="font-serif-semibold text-2xl text-foreground">
            Confirm your age
          </Text>
        </View>

        <Text className="mb-4 font-sans text-base leading-relaxed text-muted-foreground">
          Burd includes social media features and is rated {MINIMUM_AGE}+. Before you can use the
          feed, profiles, comments, and other social tools, we verify that you meet the minimum
          age requirement.
        </Text>

        <View className="mb-6 rounded-xl border border-border bg-card p-4">
          <Text className="font-sans-medium text-sm text-foreground">Social features include</Text>
          {SOCIAL_FEATURES.slice(0, 3).map((feature) => (
            <Text
              key={feature}
              className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground"
            >
              • {feature}
            </Text>
          ))}
        </View>

        {usesAppleAgeApi ? (
          <Text className="mb-4 font-sans text-sm leading-relaxed text-muted-foreground">
            Tap below to use Apple&apos;s age verification. A system sheet will ask to share your
            declared age range — Burd never sees your exact birthdate.
          </Text>
        ) : Platform.OS === "ios" ? (
          <Text className="mb-4 font-sans text-sm leading-relaxed text-muted-foreground">
            Apple age verification is available in development and App Store builds. Use the manual
            confirmation below while testing in Expo Go.
          </Text>
        ) : null}

        {error ? (
          <Text className="mb-4 font-sans text-sm text-destructive">{error}</Text>
        ) : null}

        {usesAppleAgeApi ? (
          <Pressable
            className="mb-4 items-center rounded-xl bg-primary py-3.5 active:opacity-90"
            disabled={loading}
            onPress={() => void handleVerifyWithApple()}
          >
            {loading ? (
              <ActivityIndicator color="#f0ead6" />
            ) : (
              <Text className="font-sans-bold text-base text-primary-foreground">
                Verify age with Apple
              </Text>
            )}
          </Pressable>
        ) : null}

        {(showFallback || !usesAppleAgeApi) ? (
          <View className="rounded-xl border border-border bg-card p-4">
            {showFallback ? (
              <Text className="mb-3 font-sans text-sm leading-relaxed text-muted-foreground">
                If Apple age verification is unavailable, confirm manually to continue.
              </Text>
            ) : null}
            <SignupConsent
              privacyAccepted={privacyAccepted}
              ageConfirmed={ageConfirmed}
              onPrivacyAcceptedChange={setPrivacyAccepted}
              onAgeConfirmedChange={setAgeConfirmed}
            />
            <Pressable
              className={`mt-2 items-center rounded-xl bg-primary py-3.5 active:opacity-90 ${
                !consentComplete ? "opacity-50" : ""
              }`}
              disabled={loading || !consentComplete}
              onPress={() => void handleSelfDeclaredContinue()}
            >
              {loading ? (
                <ActivityIndicator color="#f0ead6" />
              ) : (
                <Text className="font-sans-bold text-base text-primary-foreground">
                  Continue
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {user ? (
          <Pressable
            className="mt-6 items-center py-2 active:opacity-90"
            onPress={() => void handleSignOut()}
          >
            <Text className="font-sans text-sm text-muted-foreground">Sign out</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
