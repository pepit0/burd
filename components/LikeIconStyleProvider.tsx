import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMyProfile, updateLikeIconStyle } from "@/lib/sightings";
import {
  DEFAULT_LIKE_ICON_STYLE,
  normalizeLikeIconStyle,
  type LikeIconStyle,
} from "@/lib/likeIconStyle";

const STORAGE_KEY = "burd:like-icon-style";

interface LikeIconStyleContextValue {
  likeIconStyle: LikeIconStyle;
  loaded: boolean;
  setLikeIconStyle: (style: LikeIconStyle) => Promise<void>;
}

const LikeIconStyleContext = createContext<LikeIconStyleContextValue | null>(null);

export function LikeIconStyleProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [likeIconStyle, setLikeIconStyleState] = useState<LikeIconStyle>(DEFAULT_LIKE_ICON_STYLE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!mounted || !saved) return;
        setLikeIconStyleState(normalizeLikeIconStyle(saved));
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    getMyProfile(userId)
      .then((profile) => {
        if (cancelled || !profile?.like_icon_style) return;
        const next = normalizeLikeIconStyle(profile.like_icon_style);
        setLikeIconStyleState(next);
        void AsyncStorage.setItem(STORAGE_KEY, next);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setLikeIconStyle = useCallback(
    async (next: LikeIconStyle) => {
      const prev = likeIconStyle;
      setLikeIconStyleState(next);
      await AsyncStorage.setItem(STORAGE_KEY, next);

      if (!userId) return;

      try {
        await updateLikeIconStyle(userId, next);
      } catch {
        setLikeIconStyleState(prev);
        await AsyncStorage.setItem(STORAGE_KEY, prev);
        throw new Error("Could not save like icon preference.");
      }
    },
    [likeIconStyle, userId],
  );

  const value = useMemo(
    () => ({
      likeIconStyle,
      loaded,
      setLikeIconStyle,
    }),
    [likeIconStyle, loaded, setLikeIconStyle],
  );

  return (
    <LikeIconStyleContext.Provider value={value}>{children}</LikeIconStyleContext.Provider>
  );
}

export function useLikeIconStyle() {
  const ctx = useContext(LikeIconStyleContext);
  if (!ctx) {
    throw new Error("useLikeIconStyle must be used within LikeIconStyleProvider");
  }
  return ctx;
}
