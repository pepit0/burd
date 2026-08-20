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
  CelebrationUnlockOverlay,
  nextCelebrationUnlockKey,
} from "@/components/CelebrationUnlockOverlay";
import { triggerBadgeUnlockHaptic } from "@/lib/haptics";
import { playUnlockTweet } from "@/lib/pocketBird/birdsong";
import { resolveCatalogSpecies } from "@/lib/speciesCatalog";
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
    void playUnlockTweet().catch(() => undefined);
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
  const catalog = activeCelebration
    ? resolveCatalogSpecies(
        activeCelebration.species,
        activeCelebration.scientificName,
      )
    : undefined;
  const pill = activeCelebration
    ? newSpeciesCelebrationDescription(activeCelebration.lifeListCount)
    : undefined;

  return (
    <NewSpeciesUnlockContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <CelebrationUnlockOverlay
          unlockKey={unlockKey}
          visible={Boolean(activeCelebration)}
          kicker="New species"
          title={title}
          subtitle={activeCelebration?.scientificName ?? undefined}
          pill={pill}
          photo={
            activeCelebration
              ? {
                  catalogId: catalog?.id ?? null,
                  scientificName:
                    activeCelebration.scientificName ?? activeCelebration.species,
                }
              : null
          }
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
