import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SpeciesCard } from "@/components/SpeciesCard";
import { triggerBadgeUnlockHaptic } from "@/lib/haptics";
import { playUnlockTweet } from "@/lib/pocketBird/birdsong";
import { requestFieldGuideView } from "@/lib/navigationIntent";
import { seedSpeciesCollectionCard } from "@/lib/speciesCards";
import { getGuideTabCenter } from "@/lib/tabBarTargets";
import type { SpeciesCard as SpeciesCardRow } from "@/types";

interface CardUnlockContextValue {
  celebrateCardUnlock: (card: SpeciesCardRow) => Promise<void>;
}

const CardUnlockContext = createContext<CardUnlockContextValue | null>(null);

const INTRO_MS = 420;
const FLY_MS = 560;
const PRIMARY = "#5f9470";
const CREAM = "#f0ead6";

function fallbackGuideTarget(): { x: number; y: number } {
  const { width, height } = Dimensions.get("window");
  return { x: width * 0.64, y: height - 72 };
}

export function CardUnlockOverlay({
  card,
  unlockKey,
  canDismiss,
  tour = false,
  onIntroComplete,
  onDone,
  onViewCollection,
}: {
  card: SpeciesCardRow;
  unlockKey: number;
  canDismiss: boolean;
  tour?: boolean;
  onIntroComplete: () => void;
  onDone: () => void;
  onViewCollection: () => void;
}) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const cardWidth = Math.min(360, Math.round(screenWidth * 0.86));
  const cardRef = useRef<View>(null);
  const intro = useSharedValue(0);
  const fly = useSharedValue(0);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const flyingRef = useRef(false);
  const onIntroCompleteRef = useRef(onIntroComplete);
  onIntroCompleteRef.current = onIntroComplete;
  const notifyIntroComplete = useCallback(() => {
    onIntroCompleteRef.current();
  }, []);

  useEffect(() => {
    intro.value = 0;
    fly.value = 0;
    intro.value = withTiming(
      1,
      { duration: INTRO_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(notifyIntroComplete)();
      },
    );
  }, [unlockKey, intro, fly, notifyIntroComplete]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 1], [0, 1]) * interpolate(fly.value, [0, 1], [1, 0]),
  }));

  const stageStyle = useAnimatedStyle(() => {
    const t = intro.value;
    return {
      opacity: interpolate(t, [0, 0.2, 1], [0, 1, 1]) * interpolate(fly.value, [0, 0.85, 1], [1, 0.4, 0]),
      transform: [
        { translateX: dx.value * fly.value },
        { translateY: dy.value * fly.value },
        {
          scale:
            interpolate(t, [0, 0.35, 1], [0.86, 1.03, 1]) *
            interpolate(fly.value, [0, 1], [1, 0.12]),
        },
      ],
    };
  });

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 1], [0, 1]) * interpolate(fly.value, [0, 0.25], [1, 0]),
  }));

  const handleDone = () => {
    if (!canDismiss || flyingRef.current) return;
    flyingRef.current = true;
    const node = cardRef.current;
    if (!node) {
      onDone();
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      const target = getGuideTabCenter() ?? fallbackGuideTarget();
      dx.value = target.x - (x + width / 2);
      dy.value = target.y - (y + height / 2);
      fly.value = withTiming(
        1,
        { duration: FLY_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      );
    });
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="auto">
      <Animated.View
        style={[
          styles.backdrop,
          tour && styles.tourBackdrop,
          backdropStyle,
        ]}
      />
      <View
        style={[
          styles.column,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.cluster} pointerEvents="box-none">
          <Animated.View style={chromeStyle}>
            <Text style={styles.title}>Card unlocked!</Text>
          </Animated.View>

          <Animated.View style={stageStyle}>
            <View ref={cardRef} collapsable={false}>
              <SpeciesCard card={card} width={cardWidth} variant="hero" />
            </View>
          </Animated.View>

          <Animated.View style={[styles.actions, chromeStyle]}>
            {tour ? null : (
              <Pressable
                onPress={() => {
                  if (!canDismiss || flyingRef.current) return;
                  onViewCollection();
                }}
                disabled={!canDismiss}
                className="rounded-full px-6 py-3.5 active:opacity-90"
                style={{ backgroundColor: PRIMARY }}
                accessibilityRole="button"
                accessibilityLabel="View in collection"
                accessibilityState={{ disabled: !canDismiss }}
              >
                <Text
                  className="text-center font-sans-medium text-sm"
                  style={{ color: CREAM }}
                >
                  View in collection
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleDone}
              disabled={!canDismiss}
              className="rounded-full px-6 py-3.5 active:opacity-85"
              style={tour ? { backgroundColor: PRIMARY } : styles.doneButton}
              accessibilityRole="button"
              accessibilityLabel={tour ? "Continue" : "Done"}
              accessibilityState={{ disabled: !canDismiss }}
            >
              <Text
                className="text-center font-sans-medium text-sm"
                style={{ color: CREAM }}
              >
                {tour ? "Continue" : "Done"}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

export function CardUnlockProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [activeCard, setActiveCard] = useState<SpeciesCardRow | null>(null);
  const [unlockKey, setUnlockKey] = useState(0);
  const [canDismiss, setCanDismiss] = useState(false);
  const queueRef = useRef<SpeciesCardRow[]>([]);
  const showingRef = useRef(false);
  const pendingResolvesRef = useRef<Array<() => void>>([]);
  const activeCardRef = useRef<SpeciesCardRow | null>(null);
  activeCardRef.current = activeCard;

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
      setActiveCard(null);
      setCanDismiss(false);
      flushPendingResolves();
      return;
    }
    showingRef.current = true;
    setCanDismiss(false);
    setActiveCard(next);
    setUnlockKey((key) => key + 1);
    void triggerBadgeUnlockHaptic();
    void playUnlockTweet().catch(() => undefined);
  }, [flushPendingResolves]);

  const goToCollection = useCallback(() => {
    const card = activeCardRef.current;
    if (card) {
      seedSpeciesCollectionCard(card);
    }
    requestFieldGuideView({ tab: "collection" });
    router.push("/(tabs)/field-guide");
  }, [router]);

  const finish = useCallback(
    (openCollection: boolean) => {
      if (openCollection) goToCollection();
      showingRef.current = false;
      setActiveCard(null);
      setCanDismiss(false);
      startNext();
    },
    [goToCollection, startNext],
  );

  const celebrateCardUnlock = useCallback(
    (card: SpeciesCardRow): Promise<void> => {
      return new Promise<void>((resolve) => {
        pendingResolvesRef.current.push(resolve);
        queueRef.current.push(card);
        if (!showingRef.current) {
          startNext();
        }
      });
    },
    [startNext],
  );

  const value = useMemo(() => ({ celebrateCardUnlock }), [celebrateCardUnlock]);

  return (
    <CardUnlockContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {activeCard ? (
          <CardUnlockOverlay
            key={unlockKey}
            card={activeCard}
            unlockKey={unlockKey}
            canDismiss={canDismiss}
            onIntroComplete={() => setCanDismiss(true)}
            onDone={() => finish(true)}
            onViewCollection={() => finish(true)}
          />
        ) : null}
      </View>
    </CardUnlockContext.Provider>
  );
}

export function useCardUnlock(): CardUnlockContextValue {
  const context = useContext(CardUnlockContext);
  if (!context) {
    throw new Error("useCardUnlock must be used within CardUnlockProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 1600,
    elevation: 1600,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 15, 8, 0.92)",
  },
  tourBackdrop: {
    backgroundColor: "rgba(10, 15, 8, 0.84)",
  },
  column: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  cluster: {
    width: "100%",
    alignItems: "center",
    gap: 14,
  },
  title: {
    fontFamily: "DMSans_700Bold",
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: "#ffffff",
    textAlign: "center",
  },
  actions: {
    width: "100%",
    gap: 8,
  },
  doneButton: {
    borderWidth: 1.5,
    borderColor: CREAM,
    backgroundColor: "rgba(240, 234, 214, 0.12)",
  },
});
