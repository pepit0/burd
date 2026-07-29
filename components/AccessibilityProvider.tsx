import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HAPTICS_KEY = "burd:haptics-enabled";

interface AccessibilityContextValue {
  reduceMotion: boolean;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
  loaded: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });

    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);

    AsyncStorage.getItem(HAPTICS_KEY)
      .then((saved) => {
        if (mounted && saved != null) {
          setHapticsEnabledState(saved === "true");
        }
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const setHapticsEnabled = async (enabled: boolean) => {
    setHapticsEnabledState(enabled);
    await AsyncStorage.setItem(HAPTICS_KEY, enabled ? "true" : "false");
  };

  const value = useMemo(
    () => ({ reduceMotion, hapticsEnabled, setHapticsEnabled, loaded }),
    [reduceMotion, hapticsEnabled, loaded],
  );

  return (
    <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return ctx;
}

/** Safe haptics trigger — respects user preference. */
export async function triggerHaptic(
  fn: () => Promise<void> | void,
  hapticsEnabled: boolean,
): Promise<void> {
  if (!hapticsEnabled) return;
  try {
    await fn();
  } catch {
    // Haptics unavailable on some platforms
  }
}
