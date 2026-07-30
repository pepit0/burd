import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { getUserFacingMessage } from "@/lib/errors";
import { completeOAuthFromUrl } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";

function cleanOAuthParamsFromUrl(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.endsWith("/auth/callback")) {
    window.history.replaceState({}, "", path);
  }
}

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
          cleanOAuthParamsFromUrl();
          router.replace("/");
          return;
        }

        if (Platform.OS === "web" && typeof window !== "undefined") {
          const href = window.location.href;
          if (href.includes("code=") || href.includes("access_token=")) {
            await completeOAuthFromUrl(href);
            cleanOAuthParamsFromUrl();
          } else if (href.includes("error=")) {
            await completeOAuthFromUrl(href);
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

        setError("Could not complete sign in. Please try again.");
      } catch (e) {
        if (!cancelled) {
          setError(getUserFacingMessage(e, "Could not complete sign in."));
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
