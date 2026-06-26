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
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
    }

    setLoading(false);
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
          <Text className="mb-4 font-sans text-sm text-destructive">{error}</Text>
        ) : null}

        <Pressable
          className="mb-6 items-center rounded-xl bg-primary py-3.5 active:opacity-90"
          disabled={loading}
          onPress={handleSignIn}
        >
          {loading ? (
            <ActivityIndicator color="#f0ead6" />
          ) : (
            <Text className="font-sans-bold text-base text-primary-foreground">Sign in</Text>
          )}
        </Pressable>

        <Link href="/(auth)/register" asChild>
          <Pressable>
            <Text className="text-center font-sans text-base text-muted-foreground">
              Need an account? <Text className="text-primary">Register</Text>
            </Text>
          </Pressable>
        </Link>
      </KeyboardScreen>
    </SafeAreaView>
  );
}
