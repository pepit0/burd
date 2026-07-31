import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import {
  cleanAuthParamsFromUrl,
  completeAuthFromUrl,
  urlHasAuthCompletionParams,
} from "@/lib/authCallback";
import { getNativeAuthCallbackDeepLink } from "@/lib/authRedirect";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

function isMobileWebUserAgent(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function authParamsFromHref(href: string): string {
  const hashIndex = href.indexOf("#");
  const queryIndex = href.indexOf("?");
  if (hashIndex >= 0) return href.slice(hashIndex);
  if (queryIndex >= 0) return href.slice(queryIndex);
  return "";
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        const {
          data: { session: existing },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (existing) {
          handledRef.current = true;
          cleanAuthParamsFromUrl();
          router.replace("/");
          return;
        }

        const candidateUrls: string[] = [];
        if (url) candidateUrls.push(url);
        if (Platform.OS === "web" && typeof window !== "undefined") {
          candidateUrls.push(window.location.href);
        } else {
          const initial = await Linking.getInitialURL();
          if (initial) candidateUrls.push(initial);
        }

        const authUrl = candidateUrls.find((href) => urlHasAuthCompletionParams(href));

        if (
          Platform.OS === "web" &&
          typeof window !== "undefined" &&
          authUrl &&
          isMobileWebUserAgent()
        ) {
          const deepLink = getNativeAuthCallbackDeepLink(authParamsFromHref(authUrl));
          window.location.replace(deepLink);
          return;
        }

        if (authUrl) {
          await completeAuthFromUrl(authUrl);
          cleanAuthParamsFromUrl();
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
          handledRef.current = true;
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
  }, [router, url]);

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
