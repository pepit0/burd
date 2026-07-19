import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "lucide-react-native";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { useAuth } from "@/hooks/useAuth";
import { getUserFacingMessage } from "@/lib/errors";
import {
  claimUsername,
  validateUsername,
} from "@/lib/signup";

export default function ChooseUsernameScreen() {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setError(null);
    if (!user?.id) {
      setError("Sign in again to choose a username.");
      return;
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    setLoading(true);
    try {
      await claimUsername(user.id, username);
      // Root layout watches user_metadata.username and routes to tabs.
    } catch (e) {
      setError(getUserFacingMessage(e, "Could not save username."));
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
          Choose a username
        </Text>
        <Text className="mb-8 font-sans text-base text-muted-foreground">
          Pick your @handle so other birders can find you. If it's taken, try
          another.
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

        {error ? (
          <Text className="mb-4 font-sans text-sm text-destructive">{error}</Text>
        ) : null}

        <Pressable
          className="items-center rounded-xl bg-primary py-3.5 active:opacity-90"
          disabled={loading}
          onPress={() => void handleContinue()}
        >
          {loading ? (
            <ActivityIndicator color="#f0ead6" />
          ) : (
            <Text className="font-sans-bold text-base text-primary-foreground">
              Continue
            </Text>
          )}
        </Pressable>
      </KeyboardScreen>
    </SafeAreaView>
  );
}
