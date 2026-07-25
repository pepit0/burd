import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useSegments } from "expo-router";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  identify,
  initAnalytics,
  resetAnalytics,
  track,
  trackForUser,
} from "@/lib/analytics";
import { supabase } from "@/lib/supabase";

const ACTIVITY_INTERVAL_MS = 5 * 60 * 1000;

function authProviderLabel(session: Session | null): string {
  const user = session?.user;
  if (!user) return "unknown";

  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.length > 0) {
    return String(providers[0]);
  }

  const identity = user.identities?.[0]?.provider;
  return identity ?? "email";
}

function isRecentSignup(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000;
}

async function touchActivity(): Promise<void> {
  try {
    await supabase.rpc("touch_user_activity");
  } catch {
    // Best-effort heartbeat; don't interrupt the app.
  }
}

/**
 * Initializes analytics, tracks auth lifecycle events, screen views,
 * and keeps last_active_at fresh for churn reporting.
 */
export function useAnalytics(session: Session | null, loading: boolean): void {
  const segments = useSegments();
  const lastScreenRef = useRef<string | null>(null);
  const lastAuthEventRef = useRef<AuthChangeEvent | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void initAnalytics();
  }, []);

  useEffect(() => {
    if (loading) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (lastAuthEventRef.current === event && event !== "TOKEN_REFRESHED") {
        return;
      }
      lastAuthEventRef.current = event;

      setTimeout(() => {
        void (async () => {
          const user = nextSession?.user;
          if (!user) {
            if (event === "SIGNED_OUT") {
              track("signed_out");
              await resetAnalytics();
            }
            return;
          }

          const provider = authProviderLabel(nextSession);
          const traits = {
            username: user.user_metadata?.username as string | undefined,
            email: user.email,
            auth_provider: provider,
          };

          await identify(user.id, traits);

          if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
            if (isRecentSignup(user.created_at)) {
              trackForUser(user.id, "user_signed_up", {
                auth_provider: provider,
                signup_method: provider === "apple" ? "apple" : provider === "google" ? "google" : "email",
              });
            } else {
              trackForUser(user.id, "user_signed_in", {
                auth_provider: provider,
              });
            }
            void touchActivity();
          }
        })();
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loading]);

  useEffect(() => {
    if (loading || !session?.user) return;

    void identify(session.user.id, {
      username: session.user.user_metadata?.username as string | undefined,
      email: session.user.email,
      auth_provider: authProviderLabel(session),
    });
    void touchActivity();
  }, [loading, session?.user?.id]);

  useEffect(() => {
    if (loading) return;

    const screen = segments.join("/") || "root";
    if (lastScreenRef.current === screen) return;
    lastScreenRef.current = screen;

    track("screen_viewed", { screen });
  }, [loading, segments]);

  useEffect(() => {
    if (loading || !session?.user) return;

    void touchActivity();
    const interval = setInterval(() => {
      void touchActivity();
    }, ACTIVITY_INTERVAL_MS);

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === "active") {
        track("app_foregrounded");
        void touchActivity();
      } else if (state === "background") {
        track("app_backgrounded");
      }
    };

    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [loading, session?.user?.id]);
}
