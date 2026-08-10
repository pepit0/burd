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
import {
  fetchProfileBadgesForUser,
  type ProfileBadge,
} from "@/lib/profileBadges";

interface BadgeUnlockContextValue {
  syncEarnedBadges: (badges: ProfileBadge[]) => Promise<void>;
  refreshAndCelebrateBadges: () => Promise<void>;
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
  const showingRef = useRef(false);
  const celebratingIdsRef = useRef(new Set<string>());
  const pendingSyncResolvesRef = useRef<Array<() => void>>([]);
  const syncChainRef = useRef(Promise.resolve());
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const flushPendingSyncResolves = useCallback(() => {
    const resolves = pendingSyncResolvesRef.current;
    pendingSyncResolvesRef.current = [];
    for (const resolve of resolves) {
      resolve();
    }
  }, []);

  const startNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      showingRef.current = false;
      setActiveBadge(null);
      setCanDismiss(false);
      flushPendingSyncResolves();
      return;
    }
    showingRef.current = true;
    setCanDismiss(false);
    setActiveBadge(next);
    setUnlockKey((key) => nextBadgeUnlockKey(key));
    void triggerBadgeUnlockHaptic();
  }, [flushPendingSyncResolves]);

  const dismiss = useCallback(() => {
    if (!canDismiss || !activeBadge) return;

    const badgeId = activeBadge.id;
    const preview = isPreviewRef.current;
    isPreviewRef.current = false;
    setCanDismiss(false);

    if (!preview && userIdRef.current) {
      void markBadgeCelebrated(userIdRef.current, badgeId);
    }
    celebratingIdsRef.current.delete(badgeId);

    showingRef.current = false;
    setActiveBadge(null);
    startNext();
  }, [activeBadge, canDismiss, startNext]);

  const enqueue = useCallback(
    (badges: ProfileBadge[], preview: boolean) => {
      const toShow = preview
        ? badges
        : badges.filter((badge) => !celebratingIdsRef.current.has(badge.id));
      if (toShow.length === 0) return;

      isPreviewRef.current = preview;
      if (!preview) {
        for (const badge of toShow) {
          celebratingIdsRef.current.add(badge.id);
        }
      }
      queueRef.current.push(...toShow);
      if (!showingRef.current) {
        startNext();
      }
    },
    [startNext],
  );

  const syncEarnedBadges = useCallback(
    (badges: ProfileBadge[]): Promise<void> => {
      const uid = userIdRef.current;
      if (!uid) return Promise.resolve();

      const run = async (): Promise<void> => {
        const earned = badges.filter((badge) => badge.earned);
        const earnedIds = earned.map((badge) => badge.id);
        const newIds = await initializeCelebratedBadges(uid, earnedIds);
        const unseenIds = newIds.filter((id) => !celebratingIdsRef.current.has(id));
        if (unseenIds.length === 0) return;

        const newBadges = earned.filter((badge) => unseenIds.includes(badge.id));
        if (newBadges.length === 0) return;

        return new Promise<void>((resolve) => {
          pendingSyncResolvesRef.current.push(resolve);
          enqueue(newBadges, false);
        });
      };

      const next = syncChainRef.current.then(run, run);
      syncChainRef.current = next.catch(() => undefined);
      return next;
    },
    [enqueue],
  );

  const refreshAndCelebrateBadges = useCallback(async (): Promise<void> => {
    const uid = userIdRef.current;
    if (!uid) return;

    const badges = await fetchProfileBadgesForUser(uid);
    await syncEarnedBadges(badges);
  }, [syncEarnedBadges]);

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
      refreshAndCelebrateBadges,
      previewBadgeUnlock,
    }),
    [syncEarnedBadges, refreshAndCelebrateBadges, previewBadgeUnlock],
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
