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
import { Feather } from "lucide-react-native";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import {
  checkSignupAvailability,
  mapSignUpError,
  normalizeUsername,
  signupAvailabilityMessage,
  validateUsername,
} from "@/lib/signup";
import { supabase } from "@/lib/supabase";

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setError(null);

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    const normalizedUsername = normalizeUsername(username);
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
      const availability = await checkSignupAvailability(
        trimmedEmail,
        normalizedUsername,
      );
      if (availability.emailTaken || availability.usernameTaken) {
        setError(
          signupAvailabilityMessage(
            availability.emailTaken,
            availability.usernameTaken,
          ),
        );
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            username: normalizedUsername,
          },
        },
      });

      if (signUpError) {
        setError(mapSignUpError(signUpError.message));
        return;
      }

      router.replace("/(auth)/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
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
          Pick a username, then join the birding community.
        </Text>

        <Text className="mb-1 font-sans-medium text-sm text-foreground/80">
          Username
        </Text>
        <View className="mb-1 flex-row items-center rounded-xl border border-border bg-card px-4">
          <Text className="font-mono text-base text-muted-foreground">@</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect={false}
            onChangeText={setUsername}
            placeholder="marsh_watcher"
            placeholderTextColor="#8a9e82"
            value={username}
            className="flex-1 py-3 pl-1 font-sans text-base text-foreground"
          />
        </View>
        <Text className="mb-4 font-sans text-[11px] text-muted-foreground">
          Letters, numbers, and underscores · 3–30 characters
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
          className="mb-6 items-center rounded-xl bg-primary py-3.5 active:opacity-90"
          disabled={loading}
          onPress={() => void handleSignUp()}
        >
          {loading ? (
            <ActivityIndicator color="#f0ead6" />
          ) : (
            <Text className="font-sans-bold text-base text-primary-foreground">
              Register
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
