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
import { View } from "react-native";
import { useRouter, useSegments, type Href } from "expo-router";
import { AppTourOverlay } from "@/components/AppTourOverlay";
import { useAuth } from "@/hooks/useAuth";
import {
  APP_TOUR_STEPS,
  type AppTourPhase,
  type AppTourSpotlight,
  type AppTourTargetRect,
} from "@/lib/appTourSteps";
import {
  getAppTourRecord,
  persistAppTourProgress,
  setAppTourStatus,
} from "@/lib/appTourStorage";
import { requestFieldGuideView } from "@/lib/navigationIntent";

interface AppTourContextValue {
  phase: AppTourPhase;
  spotlight: AppTourSpotlight | null;
  stepIndex: number;
  startTestTour: () => void;
  reportTarget: (id: AppTourSpotlight, rect: AppTourTargetRect | null) => void;
}

const AppTourContext = createContext<AppTourContextValue | null>(null);

export function AppTourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const router = useRouter();
  const segments = useSegments();
  const onTabs = segments[0] === "(tabs)";

  const [phase, setPhase] = useState<AppTourPhase>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<AppTourTargetRect | null>(null);
  const testModeRef = useRef(false);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const spotlightRef = useRef<AppTourSpotlight | null>(null);

  const persistProgress = useCallback(
    async (nextPhase: "welcome" | "tour", nextStep: number) => {
      const id = userIdRef.current;
      if (!id || testModeRef.current) return;
      try {
        await persistAppTourProgress(id, nextPhase, nextStep);
      } catch {
        // Tour progress should not block the app.
      }
    },
    [],
  );

  const persistCompleted = useCallback(async () => {
    const id = userIdRef.current;
    if (!id || testModeRef.current) return;
    try {
      await setAppTourStatus(id, "completed");
    } catch {
      // Tour progress should not block the app.
    }
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      const step = APP_TOUR_STEPS[index];
      if (!step) return;
      if (step.spotlight !== spotlightRef.current) {
        setTargetRect(null);
      }
      if (step.guideTab) {
        requestFieldGuideView({ tab: step.guideTab });
      }
      setStepIndex(index);
      router.navigate(step.route as Href);
    },
    [router],
  );

  const reportTarget = useCallback(
    (id: AppTourSpotlight, rect: AppTourTargetRect | null) => {
      if (id !== spotlightRef.current) return;
      setTargetRect(rect);
    },
    [],
  );

  const startTestTour = useCallback(() => {
    testModeRef.current = true;
    setStepIndex(0);
    setTargetRect(null);
    setPhase("awaiting-tabs");
    router.replace("/(tabs)/");
  }, [router]);

  const finishTour = useCallback(() => {
    void persistCompleted();
    testModeRef.current = false;
    setPhase("idle");
    setStepIndex(0);
    setTargetRect(null);
  }, [persistCompleted]);

  const onWelcomeContinue = useCallback(() => {
    goToStep(0);
    setPhase("tour");
    void persistProgress("tour", 0);
  }, [goToStep, persistProgress]);

  const onNext = useCallback(() => {
    if (stepIndex >= APP_TOUR_STEPS.length - 1) {
      finishTour();
      return;
    }
    const next = stepIndex + 1;
    goToStep(next);
    void persistProgress("tour", next);
  }, [finishTour, goToStep, persistProgress, stepIndex]);

  const onBack = useCallback(() => {
    if (stepIndex <= 0) {
      setTargetRect(null);
      setPhase("welcome");
      void persistProgress("welcome", 0);
      return;
    }
    const prev = stepIndex - 1;
    goToStep(prev);
    void persistProgress("tour", prev);
  }, [goToStep, persistProgress, stepIndex]);

  useEffect(() => {
    if (phase === "awaiting-tabs" && onTabs) {
      setPhase("welcome");
    }
  }, [onTabs, phase]);

  useEffect(() => {
    if (!userId) {
      testModeRef.current = false;
      setPhase("idle");
      setStepIndex(0);
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    void getAppTourRecord(userId).then((record) => {
      if (cancelled || testModeRef.current) return;
      if (record?.status !== "pending" || !onTabs) return;

      // Legacy: Plus upsell step removed — finish tour if user was on it.
      if (record.phase === "plus") {
        void setAppTourStatus(userId, "completed");
        return;
      }

      setPhase((prev) => {
        if (prev !== "idle") return prev;
        if (record.phase === "tour") return "tour";
        return "welcome";
      });
      if (record.phase === "tour") {
        const index = Math.min(record.stepIndex, APP_TOUR_STEPS.length - 1);
        setStepIndex(index);
        const step = APP_TOUR_STEPS[index];
        if (step) {
          if (step.guideTab) requestFieldGuideView({ tab: step.guideTab });
          router.navigate(step.route as Href);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [onTabs, router, userId]);

  const spotlight =
    phase === "tour" ? (APP_TOUR_STEPS[stepIndex]?.spotlight ?? null) : null;
  spotlightRef.current = spotlight;

  const value = useMemo(
    () => ({
      phase,
      spotlight,
      stepIndex,
      startTestTour,
      reportTarget,
    }),
    [phase, reportTarget, spotlight, startTestTour, stepIndex],
  );

  return (
    <AppTourContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <AppTourOverlay
          phase={phase}
          stepIndex={stepIndex}
          targetRect={targetRect}
          onWelcomeContinue={onWelcomeContinue}
          onNext={onNext}
          onBack={onBack}
        />
      </View>
    </AppTourContext.Provider>
  );
}

export function useAppTour(): AppTourContextValue {
  const context = useContext(AppTourContext);
  if (!context) {
    throw new Error("useAppTour must be used within AppTourProvider");
  }
  return context;
}

export function useAppTourOptional(): AppTourContextValue | null {
  return useContext(AppTourContext);
}
