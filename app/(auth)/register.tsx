import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather, Mail } from "lucide-react-native";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import {
  SignupConsent,
  SignupSocialNotice,
  hasSignupConsent,
} from "@/components/SignupConsent";
import { getEmailAuthRedirectUri } from "@/lib/authRedirect";
import { getSignupPlatform, track } from "@/lib/analytics";
import { getUserFacingMessage } from "@/lib/errors";
import {
  isAlreadyRegisteredError,
  mapSignUpError,
  resendSignupConfirmation,
  signUpWithEmail,
} from "@/lib/signup";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const consentComplete = hasSignupConsent(privacyAccepted, ageConfirmed);

  async function handleSignUp() {
    setError(null);
    setResendNote(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Enter your email.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (!consentComplete) {
      setError("Please accept the Terms & Privacy Policy and confirm you are at least 13.");
      return;
    }

    setLoading(true);
    track("signup_started", { signup_method: "email" });

    try {
      const { data, error: signUpError } = await signUpWithEmail({
        email: trimmedEmail,
        password,
        emailRedirectTo: getEmailAuthRedirectUri(),
        metadata: {
          username_chosen: false,
          signup_platform: getSignupPlatform(),
          signup_method: "email",
          privacy_policy_accepted_at: new Date().toISOString(),
          age_confirmed_at: new Date().toISOString(),
        },
      });

      if (signUpError) {
        const message = getUserFacingMessage(
          signUpError,
          "Could not create account. Please try again.",
        );
        if (isAlreadyRegisteredError(message)) {
          const resend = await resendSignupConfirmation(trimmedEmail, password);
          if (resend.ok) {
            track("signup_email_confirmation_sent", {
              signup_method: "email",
              resent: true,
            });
            setPendingEmail(trimmedEmail);
            setResendNote("We sent another confirmation link to your email.");
            return;
          }
        }
        setError(mapSignUpError(message));
        return;
      }

      if (data.user?.identities?.length === 0) {
        const resend = await resendSignupConfirmation(trimmedEmail, password);
        if (resend.ok) {
          track("signup_email_confirmation_sent", {
            signup_method: "email",
            resent: true,
          });
          setPendingEmail(trimmedEmail);
          setResendNote("We sent another confirmation link to your email.");
          return;
        }
      }

      // Session present → root layout sends them to choose-username.
      if (data.session) {
        track("signup_completed", {
          signup_method: "email",
          email_confirmation_required: false,
        });
        return;
      }

      track("signup_email_confirmation_sent", { signup_method: "email" });
      setPendingEmail(trimmedEmail);
    } catch (e) {
      setError(
        getUserFacingMessage(e, "Could not create account. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!pendingEmail || resending) return;
    setResending(true);
    setResendNote(null);
    setError(null);
    try {
      const result = await resendSignupConfirmation(pendingEmail, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResendNote("Confirmation email sent again.");
    } finally {
      setResending(false);
    }
  }

  if (pendingEmail) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardScreen
          className="flex-1"
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-8 items-center">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
              <Mail size={28} color="#5f9470" />
            </View>
            <Text className="mb-2 text-center font-serif-semibold text-2xl text-foreground">
              Check your email
            </Text>
            <Text className="text-center font-sans text-base leading-relaxed text-muted-foreground">
              We sent a confirmation link to{" "}
              <Text className="font-sans-medium text-foreground">
                {pendingEmail}
              </Text>
              . Open it to confirm your account — Burd will reopen so you
              can choose your @username and display name.
            </Text>
          </View>

          {error ? (
            <Text className="mb-4 text-center font-sans text-sm text-destructive">
              {error}
            </Text>
          ) : null}
          {resendNote ? (
            <Text className="mb-4 text-center font-sans text-sm text-primary">
              {resendNote}
            </Text>
          ) : null}

          <Pressable
            className="mb-3 items-center rounded-xl border border-border bg-card py-3.5 active:opacity-90"
            disabled={resending}
            onPress={() => void handleResend()}
          >
            {resending ? (
              <ActivityIndicator color="#5f9470" />
            ) : (
              <Text className="font-sans-medium text-base text-foreground">
                Resend confirmation email
              </Text>
            )}
          </Pressable>

          <Pressable
            className="mb-6 items-center rounded-xl bg-primary py-3.5 active:opacity-90"
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text className="font-sans-bold text-base text-primary-foreground">
              Back to sign in
            </Text>
          </Pressable>
        </KeyboardScreen>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardScreen
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6 py-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 flex-row items-center gap-2.5">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Feather size={20} color="#f0ead6" />
          </View>
          <Text className="font-serif-semibold text-3xl tracking-tight text-foreground">
            Burd
          </Text>
        </View>

        <Text className="mb-2 font-serif-semibold text-2xl text-foreground">
          Create account
        </Text>
        <Text className="mb-8 font-sans text-base text-muted-foreground">
          Sign up with Apple, Google, or email. You'll choose your profile next.
        </Text>

        <SocialAuthButtons
          recordConsent
          onError={setError}
          className="mb-2"
        />
        <SignupSocialNotice className="mb-8" />

        <View className="mb-3 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-border" />
          <Text className="font-sans text-xs text-muted-foreground">or sign up with email</Text>
          <View className="h-px flex-1 bg-border" />
        </View>

        <Text className="mb-1 font-sans-medium text-sm text-foreground/80">Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#8a9e82"
          value={email}
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 font-sans text-base text-foreground"
        />

        <Text className="mb-1 font-sans-medium text-sm text-foreground/80">Password</Text>
        <TextInput
          autoComplete="new-password"
          onChangeText={setPassword}
          placeholder="Choose a password"
          placeholderTextColor="#8a9e82"
          secureTextEntry
          value={password}
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 font-sans text-base text-foreground"
        />

        {error ? (
          <Text className="mb-4 font-sans text-sm text-destructive">{error}</Text>
        ) : null}

        <SignupConsent
          className="mb-5"
          privacyAccepted={privacyAccepted}
          ageConfirmed={ageConfirmed}
          onPrivacyAcceptedChange={setPrivacyAccepted}
          onAgeConfirmedChange={setAgeConfirmed}
        />

        <Pressable
          className={`mb-6 items-center rounded-xl bg-primary py-3.5 active:opacity-90 ${
            !consentComplete ? "opacity-50" : ""
          }`}
          disabled={loading || !consentComplete}
          onPress={() => void handleSignUp()}
        >
          {loading ? (
            <ActivityIndicator color="#f0ead6" />
          ) : (
            <Text className="font-sans-bold text-base text-primary-foreground">
              Sign up with email
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace("/(auth)/login")}>
          <Text className="text-center font-sans text-base text-muted-foreground">
            Already have an account? <Text className="text-primary">Sign in</Text>
          </Text>
        </Pressable>
      </KeyboardScreen>
    </SafeAreaView>
  );
}
