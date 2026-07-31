import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";
import {
  BadgeUnlockOverlay,
  nextBadgeUnlockKey,
} from "@/components/BadgeUnlockOverlay";
import { triggerBadgeUnlockHaptic } from "@/lib/haptics";
import {
  initializeCelebratedBadges,
  markBadgeCelebrated,
} from "@/lib/badgeUnlockStorage";
import type { ProfileBadge } from "@/lib/profileBadges";

interface BadgeUnlockContextValue {
  syncEarnedBadges: (badges: ProfileBadge[]) => Promise<void>;
  previewBadgeUnlock: (badge: ProfileBadge) => void;
}

const BadgeUnlockContext = createContext<BadgeUnlockContextValue | null>(null);

export function BadgeUnlockProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [activeBadge, setActiveBadge] = useState<ProfileBadge | null>(null);
  const [unlockKey, setUnlockKey] = useState(0);
  const [canDismiss, setCanDismiss] = useState(false);
  const queueRef = useRef<ProfileBadge[]>([]);
  const isPreviewRef = useRef(false);
  const syncingRef = useRef(false);
  const showingRef = useRef(false);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const startNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      showingRef.current = false;
      setActiveBadge(null);
      setCanDismiss(false);
      return;
    }
    showingRef.current = true;
    setCanDismiss(false);
    setActiveBadge(next);
    setUnlockKey((key) => nextBadgeUnlockKey(key));
    void triggerBadgeUnlockHaptic();
  }, []);

  const dismiss = useCallback(() => {
    if (!canDismiss || !activeBadge) return;

    const badgeId = activeBadge.id;
    const preview = isPreviewRef.current;
    isPreviewRef.current = false;
    setCanDismiss(false);

    if (!preview && userIdRef.current) {
      void markBadgeCelebrated(userIdRef.current, badgeId);
    }

    showingRef.current = false;
    setActiveBadge(null);
    startNext();
  }, [activeBadge, canDismiss, startNext]);

  const enqueue = useCallback(
    (badges: ProfileBadge[], preview: boolean) => {
      if (badges.length === 0) return;
      isPreviewRef.current = preview;
      queueRef.current.push(...badges);
      if (!showingRef.current) {
        startNext();
      }
    },
    [startNext],
  );

  const syncEarnedBadges = useCallback(
    async (badges: ProfileBadge[]) => {
      const uid = userIdRef.current;
      if (!uid || syncingRef.current) return;

      syncingRef.current = true;
      try {
        const earned = badges.filter((badge) => badge.earned);
        const earnedIds = earned.map((badge) => badge.id);
        const newIds = await initializeCelebratedBadges(uid, earnedIds);
        if (newIds.length === 0) return;

        const newBadges = earned.filter((badge) => newIds.includes(badge.id));
        enqueue(newBadges, false);
      } finally {
        syncingRef.current = false;
      }
    },
    [enqueue],
  );

  const previewBadgeUnlock = useCallback(
    (badge: ProfileBadge) => {
      queueRef.current = [{ ...badge, earned: true }];
      isPreviewRef.current = true;
      showingRef.current = false;
      setActiveBadge(null);
      setCanDismiss(false);
      startNext();
    },
    [startNext],
  );

  const onIntroComplete = useCallback(() => {
    setCanDismiss(true);
  }, []);

  const value = useMemo(
    () => ({
      syncEarnedBadges,
      previewBadgeUnlock,
    }),
    [syncEarnedBadges, previewBadgeUnlock],
  );

  return (
    <BadgeUnlockContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <BadgeUnlockOverlay
          unlockKey={unlockKey}
          badge={activeBadge}
          canDismiss={canDismiss}
          onIntroComplete={onIntroComplete}
          onDismiss={dismiss}
        />
      </View>
    </BadgeUnlockContext.Provider>
  );
}

export function useBadgeUnlock(): BadgeUnlockContextValue {
  const context = useContext(BadgeUnlockContext);
  if (!context) {
    throw new Error("useBadgeUnlock must be used within BadgeUnlockProvider");
  }
  return context;
}
