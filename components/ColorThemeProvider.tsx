import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { paletteForMode, type AppColorMode, type AppPalette } from "@/lib/colorTheme";

const STORAGE_KEY = "burd:color-mode";

interface ColorThemeContextValue {
  mode: AppColorMode;
  palette: AppPalette;
  loaded: boolean;
  setMode: (mode: AppColorMode) => Promise<void>;
  toggleColorblindMode: () => Promise<void>;
}

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null);

export function ColorThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppColorMode>("default");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!mounted) return;
        if (saved === "colorblind" || saved === "default") {
          setModeState(saved);
        }
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = async (nextMode: AppColorMode) => {
    setModeState(nextMode);
    await AsyncStorage.setItem(STORAGE_KEY, nextMode);
  };

  const toggleColorblindMode = async () => {
    const next = mode === "colorblind" ? "default" : "colorblind";
    await setMode(next);
  };

  const value = useMemo<ColorThemeContextValue>(
    () => ({
      mode,
      palette: paletteForMode(mode),
      loaded,
      setMode,
      toggleColorblindMode,
    }),
    [mode, loaded],
  );

  return <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>;
}

export function useColorTheme() {
  const ctx = useContext(ColorThemeContext);
  if (!ctx) {
    throw new Error("useColorTheme must be used within ColorThemeProvider");
  }
  return ctx;
}

