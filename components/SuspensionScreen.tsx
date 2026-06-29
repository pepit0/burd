import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldAlert } from "lucide-react-native";
import { formatSuspensionExpiry } from "@/lib/moderation";
import { supabase } from "@/lib/supabase";

interface SuspensionScreenProps {
  reason: string | null;
  suspendedUntil: string | null;
}

export function SuspensionScreen({ reason, suspendedUntil }: SuspensionScreenProps) {
  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-6">
      <View className="flex-1 items-center justify-center">
        <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15">
          <ShieldAlert size={32} color="#f87171" />
        </View>
        <Text className="text-center font-serif-semibold text-2xl text-foreground">
          Account suspended
        </Text>
        <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
          {reason ?? "Your account has been suspended for violating community guidelines."}
        </Text>
        <Text className="mt-4 text-center font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {suspendedUntil
            ? `Until ${formatSuspensionExpiry(suspendedUntil)}`
            : "Indefinite suspension"}
        </Text>
        <Text className="mt-6 text-center font-sans text-xs text-muted-foreground/80">
          Posting, commenting, and liking are disabled while suspended.
        </Text>
      </View>

      <Pressable
        onPress={() => void signOut()}
        className="mb-4 items-center rounded-xl border border-border py-3.5 active:opacity-80"
      >
        <Text className="font-sans-medium text-sm text-foreground">Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}
