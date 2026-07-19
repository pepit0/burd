import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { Feather } from "lucide-react-native";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { AUTH_EMAIL_REDIRECT_TO } from "@/lib/authRedirect";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

function isEmailNotConfirmed(message: string): boolean {
  return /email not confirmed|confirm your email|email_not_confirmed/i.test(
    message,
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    setResendNote(null);
    setNeedsConfirmation(false);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        const message = getUserFacingMessage(signInError, signInError.message);
        setError(message);
        setNeedsConfirmation(isEmailNotConfirmed(signInError.message));
      }
      // On success, root layout reacts to the session — don't navigate here.
    } catch (e) {
      setError(getUserFacingMessage(e, "Could not sign in. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    const trimmed = email.trim();
    if (!trimmed || resending) return;
    setResending(true);
    setResendNote(null);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: trimmed,
        options: { emailRedirectTo: AUTH_EMAIL_REDIRECT_TO },
      });
      if (resendError) {
        setError(getUserFacingMessage(resendError));
        return;
      }
      setResendNote("Confirmation email sent. Check your inbox.");
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardScreen
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6"
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
          Welcome back
        </Text>
        <Text className="mb-8 font-sans text-base text-muted-foreground">
          Sign in to log your sightings and follow the flock.
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
          autoComplete="password"
          onChangeText={setPassword}
          placeholder="Your password"
          placeholderTextColor="#8a9e82"
          secureTextEntry
          value={password}
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 font-sans text-base text-foreground"
        />

        {error ? (
          <Text className="mb-3 font-sans text-sm text-destructive">{error}</Text>
        ) : null}
        {resendNote ? (
          <Text className="mb-3 font-sans text-sm text-primary">{resendNote}</Text>
        ) : null}

        {needsConfirmation ? (
          <Pressable
            className="mb-4 items-center rounded-xl border border-border bg-card py-3 active:opacity-90"
            disabled={resending}
            onPress={() => void handleResendConfirmation()}
          >
            {resending ? (
              <ActivityIndicator color="#5f9470" />
            ) : (
              <Text className="font-sans-medium text-sm text-foreground">
                Resend confirmation email
              </Text>
            )}
          </Pressable>
        ) : null}

        <Pressable
          className="mb-4 items-center rounded-xl bg-primary py-3.5 active:opacity-90"
          disabled={loading}
          onPress={handleSignIn}
        >
          {loading ? (
            <ActivityIndicator color="#f0ead6" />
          ) : (
            <Text className="font-sans-bold text-base text-primary-foreground">
              Sign in
            </Text>
          )}
        </Pressable>

        <SocialAuthButtons onError={setError} className="mb-6" />

        <Link href="/(auth)/register" asChild>
          <Pressable>
            <Text className="text-center font-sans text-base text-muted-foreground">
              Don't have an account?{" "}
              <Text className="text-primary">Sign up here!</Text>
            </Text>
          </Pressable>
        </Link>
      </KeyboardScreen>
    </SafeAreaView>
  );
}
