import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  cleanAuthParamsFromUrl,
  completeAuthFromUrl,
  urlHasAuthCompletionParams,
} from "@/lib/authCallback";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const {
          data: { session: existing },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (existing) {
          cleanAuthParamsFromUrl();
          router.replace("/");
          return;
        }

        if (Platform.OS === "web" && typeof window !== "undefined") {
          const href = window.location.href;
          if (urlHasAuthCompletionParams(href)) {
            await completeAuthFromUrl(href);
            cleanAuthParamsFromUrl();
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (sessionError) {
          setError(getUserFacingMessage(sessionError));
          return;
        }
        if (session) {
          router.replace("/");
          return;
        }

        setError(
          "Could not finish signing you in. Open the confirmation link again or sign in with your password.",
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            getUserFacingMessage(
              e,
              "Could not finish signing you in. Try the link again or sign in with your password.",
            ),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      {error ? (
        <Text className="text-center font-sans text-sm text-destructive">{error}</Text>
      ) : (
        <ActivityIndicator color="#5f9470" size="large" />
      )}
    </View>
  );
}
