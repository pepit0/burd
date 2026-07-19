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
import { AUTH_EMAIL_REDIRECT_TO } from "@/lib/authRedirect";
import {
  checkEmailAvailable,
  mapSignUpError,
} from "@/lib/signup";
import { supabase } from "@/lib/supabase";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);

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

    setLoading(true);

    try {
      const emailOk = await checkEmailAvailable(trimmedEmail);
      if (!emailOk) {
        setError("An account already exists with this email.");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: AUTH_EMAIL_REDIRECT_TO,
          data: {
            username_chosen: false,
          },
        },
      });

      if (signUpError) {
        setError(mapSignUpError(signUpError.message));
        return;
      }

      // Session present → root layout sends them to choose-username.
      if (data.session) {
        return;
      }

      setPendingEmail(trimmedEmail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account.");
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
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: AUTH_EMAIL_REDIRECT_TO },
      });
      if (resendError) {
        setError(resendError.message);
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
              . Open it to activate your account, then sign in — you'll pick
              your @username next.
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
          Sign up with email, Apple, or Google. You'll choose an @username
          after you're signed in.
        </Text>

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

        <Pressable
          className="mb-4 items-center rounded-xl bg-primary py-3.5 active:opacity-90"
          disabled={loading}
          onPress={() => void handleSignUp()}
        >
          {loading ? (
            <ActivityIndicator color="#f0ead6" />
          ) : (
            <Text className="font-sans-bold text-base text-primary-foreground">
              Sign up
            </Text>
          )}
        </Pressable>

        <SocialAuthButtons onError={setError} className="mb-6" />

        <Pressable onPress={() => router.replace("/(auth)/login")}>
          <Text className="text-center font-sans text-base text-muted-foreground">
            Already have an account? <Text className="text-primary">Sign in</Text>
          </Text>
        </Pressable>
      </KeyboardScreen>
    </SafeAreaView>
  );
}
