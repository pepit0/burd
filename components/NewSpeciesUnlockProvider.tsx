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
import { Feather } from "lucide-react-native";
import {
  CelebrationUnlockOverlay,
  nextCelebrationUnlockKey,
} from "@/components/CelebrationUnlockOverlay";
import { FAMILY_STYLES } from "@/components/ProfileBadges";
import { triggerBadgeUnlockHaptic } from "@/lib/haptics";
import {
  buildNewSpeciesCelebration,
  newSpeciesCelebrationDescription,
  newSpeciesCelebrationTitle,
  type NewSpeciesCelebration,
} from "@/lib/newSpeciesCelebration";

interface NewSpeciesUnlockContextValue {
  celebrateNewSpecies: (celebration: NewSpeciesCelebration) => Promise<void>;
  previewNewSpecies: (celebration?: NewSpeciesCelebration) => void;
}

const NewSpeciesUnlockContext = createContext<NewSpeciesUnlockContextValue | null>(null);

const LIFE_LIST_ICON = FAMILY_STYLES.life_list;

export function NewSpeciesUnlockProvider({ children }: { children: ReactNode }) {
  const [activeCelebration, setActiveCelebration] = useState<NewSpeciesCelebration | null>(
    null,
  );
  const [unlockKey, setUnlockKey] = useState(0);
  const [canDismiss, setCanDismiss] = useState(false);
  const queueRef = useRef<NewSpeciesCelebration[]>([]);
  const showingRef = useRef(false);
  const pendingResolvesRef = useRef<Array<() => void>>([]);

  const flushPendingResolves = useCallback(() => {
    const resolves = pendingResolvesRef.current;
    pendingResolvesRef.current = [];
    for (const resolve of resolves) {
      resolve();
    }
  }, []);

  const startNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      showingRef.current = false;
      setActiveCelebration(null);
      setCanDismiss(false);
      flushPendingResolves();
      return;
    }
    showingRef.current = true;
    setCanDismiss(false);
    setActiveCelebration(next);
    setUnlockKey((key) => nextCelebrationUnlockKey(key));
    void triggerBadgeUnlockHaptic();
  }, [flushPendingResolves]);

  const dismiss = useCallback(() => {
    if (!canDismiss || !activeCelebration) return;
    setCanDismiss(false);
    showingRef.current = false;
    setActiveCelebration(null);
    startNext();
  }, [activeCelebration, canDismiss, startNext]);

  const enqueue = useCallback(
    (celebrations: NewSpeciesCelebration[]) => {
      if (celebrations.length === 0) return;
      queueRef.current.push(...celebrations);
      if (!showingRef.current) {
        startNext();
      }
    },
    [startNext],
  );

  const celebrateNewSpecies = useCallback(
    (celebration: NewSpeciesCelebration): Promise<void> => {
      return new Promise<void>((resolve) => {
        pendingResolvesRef.current.push(resolve);
        enqueue([celebration]);
      });
    },
    [enqueue],
  );

  const previewNewSpecies = useCallback(
    (celebration?: NewSpeciesCelebration) => {
      queueRef.current = [
        celebration ??
          buildNewSpeciesCelebration("American Robin", "Turdus migratorius", 12),
      ];
      showingRef.current = false;
      setActiveCelebration(null);
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
      celebrateNewSpecies,
      previewNewSpecies,
    }),
    [celebrateNewSpecies, previewNewSpecies],
  );

  const title = activeCelebration
    ? newSpeciesCelebrationTitle(
        activeCelebration.species,
        activeCelebration.scientificName,
      )
    : "";
  const description = activeCelebration
    ? newSpeciesCelebrationDescription(activeCelebration.lifeListCount)
    : "";

  return (
    <NewSpeciesUnlockContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <CelebrationUnlockOverlay
          unlockKey={unlockKey}
          visible={Boolean(activeCelebration)}
          kicker="New species"
          title={title}
          description={description}
          icon={Feather}
          iconStyle={{
            backgroundColor: LIFE_LIST_ICON.earnedBg,
            borderColor: LIFE_LIST_ICON.earnedIcon,
            iconColor: LIFE_LIST_ICON.earnedIcon,
            iconFill: LIFE_LIST_ICON.earnedIconFill,
          }}
          canDismiss={canDismiss}
          onIntroComplete={onIntroComplete}
          onDismiss={dismiss}
        />
      </View>
    </NewSpeciesUnlockContext.Provider>
  );
}

export function useNewSpeciesUnlock(): NewSpeciesUnlockContextValue {
  const context = useContext(NewSpeciesUnlockContext);
  if (!context) {
    throw new Error("useNewSpeciesUnlock must be used within NewSpeciesUnlockProvider");
  }
  return context;
}
