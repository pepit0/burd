import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BookOpen, Mic, Square, Trash2, X } from "lucide-react-native";
import { LiveSoundWaveform } from "@/components/LiveSoundWaveform";
import { LiveSpeciesRow } from "@/components/LiveSpeciesRow";
import { LocationAccuracyBanner } from "@/components/LocationAccuracyBanner";
import { useAuth } from "@/hooks/useAuth";
import { useLiveSoundId } from "@/hooks/useLiveSoundId";
import { enrichPrediction } from "@/lib/predictionLabels";
import { SHOW_LIVE_SOUND_CONFIDENCE } from "@/lib/soundDebug";

export default function AudioIdentifyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const {
    status,
    statusLabel,
    micPermission,
    locationPermission,
    meteringLevel,
    displayRows,
    sessionReview,
    selectedPrimaryKey,
    setSelectedPrimaryKey,
    sessionResult,
    errorMessage,
    chunkWarning,
    isActive,
    requestMicPermission,
    requestLocationPermission,
    openLocationSettings,
    startSession,
    stopSession,
    saveToJournal,
    discardSession,
    handoffToNewSighting,
    retrySave,
    resetSession,
  } = useLiveSoundId(userId);

  const autoBackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const topInsetRef = useRef(insets.top);
  if (insets.top > topInsetRef.current) {
    topInsetRef.current = insets.top;
  }
  const topPad = topInsetRef.current + 8;
  const bottomPad = insets.bottom + 16;

  useEffect(() => {
    if (status !== "done" || !sessionResult) return;

    autoBackRef.current = setTimeout(() => {
      if (sessionResult.kind === "journal") {
        router.replace(`/sighting/${sessionResult.sightingId}`);
      } else {
        router.back();
      }
    }, 1200);

    return () => {
      if (autoBackRef.current) {
        clearTimeout(autoBackRef.current);
        autoBackRef.current = null;
      }
    };
  }, [router, sessionResult, status]);

  async function handleListenPress() {
    if (status === "done" || status === "error" || status === "review") {
      resetSession();
      return;
    }

    if (isActive || status === "saving") {
      await stopSession();
      return;
    }

    if (micPermission === "denied") {
      await requestMicPermission();
      return;
    }

    await startSession();
  }

  const listening = status === "listening" || status === "processing";
  const reviewDetections = sessionReview?.sessionDetections ?? [];
  const selectedDetection =
    reviewDetections.find((detection) => detection.key === selectedPrimaryKey) ??
    sessionReview?.top ??
    null;
  const reviewPrimary = selectedDetection
    ? enrichPrediction(selectedDetection.prediction)
    : null;

  return (
    <View className="flex-1 bg-background">
      <View
        className="flex-row items-center justify-between px-4 pb-2"
        style={{ paddingTop: topPad }}
      >
        <Pressable
          onPress={() => {
            if (status === "review") {
              discardSession();
              router.back();
              return;
            }
            if (isActive) {
              void stopSession();
              return;
            }
            router.back();
          }}
          className="p-1"
          hitSlop={8}
        >
          <X size={22} color="#8a9e82" />
        </Pressable>
        <Text className="font-serif-semibold text-lg text-foreground">
          Live Sound ID
        </Text>
        <View className="w-7" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 px-4"
        contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LocationAccuracyBanner
          permission={locationPermission}
          onEnablePress={() => {
            if (locationPermission === "denied") {
              openLocationSettings();
              return;
            }
            void requestLocationPermission();
          }}
        />

        <Text className="mt-2 text-center font-sans-medium text-sm text-primary">
          {statusLabel}
        </Text>

        {chunkWarning && (listening || status === "review") ? (
          <View className="mt-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
            <Text className="text-center font-sans text-xs leading-relaxed text-accent">
              {chunkWarning}
            </Text>
          </View>
        ) : null}

        <View className="mt-4">
          <LiveSoundWaveform active={listening} level={meteringLevel} />
        </View>

        <View className="items-center py-6">
          <Pressable
            onPress={() => void handleListenPress()}
            disabled={status === "saving" || status === "review"}
            className={`h-32 w-32 items-center justify-center rounded-full border-4 active:opacity-90 ${
              listening
                ? "border-accent bg-accent/20"
                : "border-primary/40 bg-primary/10"
            } ${status === "saving" || status === "review" ? "opacity-60" : ""}`}
          >
            {status === "saving" ? (
              <ActivityIndicator color="#5f9470" size="large" />
            ) : listening ? (
              <Square size={36} color="#c8893a" fill="#c8893a" />
            ) : (
              <Mic size={36} color="#5f9470" />
            )}
          </Pressable>
          <Text className="mt-4 font-sans text-sm text-muted-foreground">
            {listening
              ? "Tap to stop"
              : status === "review"
                ? "Choose what to do with this recording"
                : status === "done"
                  ? "Tap to listen again"
                  : "Tap to listen"}
          </Text>
        </View>

        {micPermission !== "granted" && status === "idle" ? (
          <View className="mb-4 rounded-xl border border-border bg-card px-4 py-3">
            <Text className="font-sans-medium text-sm text-foreground">
              Microphone access needed
            </Text>
            <Text className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
              Burd listens continuously for bird calls and sends them to Perch
              for identification. Your audio is only used while this screen is
              open.
            </Text>
            {micPermission === "denied" ? (
              <Pressable
                onPress={() => void requestMicPermission()}
                className="mt-3 items-center rounded-lg bg-primary py-2.5 active:opacity-90"
              >
                <Text className="font-sans-medium text-sm text-primary-foreground">
                  Enable microphone
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {status === "review" ? (
          <View className="mb-4 gap-3 rounded-xl border border-border bg-card px-4 py-4">
            <Text className="font-sans-medium text-sm text-foreground">
              {reviewDetections.length > 0
                ? `Birds heard this session (${reviewDetections.length})`
                : "No birds identified — save clip anyway?"}
            </Text>
            {reviewDetections.length > 0 ? (
              <View className="gap-2">
                <Text className="font-sans text-xs text-muted-foreground">
                  Tap a species to set the journal entry primary. All species and
                  peak percentages are saved with the recording.
                </Text>
                {reviewDetections.map((detection) => (
                  <LiveSpeciesRow
                    key={detection.key}
                    detection={detection}
                    isExpiring={false}
                    selectable
                    selected={detection.key === selectedPrimaryKey}
                    onPress={() => setSelectedPrimaryKey(detection.key)}
                  />
                ))}
              </View>
            ) : null}
            {reviewPrimary && reviewDetections.length > 0 ? (
              <Text className="font-sans text-xs leading-relaxed text-muted-foreground">
                Journal entry primary: {reviewPrimary.species}.{" "}
                {reviewDetections.length > 1
                  ? `${reviewDetections.length} species with confidence scores will be stored.`
                  : "Peak confidence from this session will be stored."}
              </Text>
            ) : (
              <Text className="font-sans text-xs leading-relaxed text-muted-foreground">
                Saved entries go to your journal only. Share to your profile later
                when you are ready.
              </Text>
            )}
            <View className="mt-1 flex-row gap-2">
              <Pressable
                onPress={() => discardSession()}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border py-3 active:opacity-90"
              >
                <Trash2 size={16} color="#8a9e82" />
                <Text className="font-sans-medium text-sm text-foreground">
                  Discard
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void saveToJournal()}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 active:opacity-90"
              >
                <BookOpen size={16} color="#f0ead6" />
                <Text className="font-sans-medium text-sm text-primary-foreground">
                  Save to journal
                </Text>
              </Pressable>
            </View>
            {reviewPrimary ? (
              <Pressable
                onPress={() => {
                  if (!handoffToNewSighting()) return;
                  router.push({
                    pathname: "/new-sighting",
                    params: {
                      source: "audio",
                      species: reviewPrimary.species,
                      scientific_name: reviewPrimary.scientific_name ?? "",
                      confidence: String(selectedDetection?.peakConfidence ?? ""),
                      audio_only: "1",
                    },
                  });
                }}
                className="items-center py-2 active:opacity-90"
              >
                <Text className="font-sans-medium text-sm text-primary">
                  Edit details before saving
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {status === "done" && sessionResult ? (
          <View className="mb-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
            <Text className="font-sans-medium text-sm text-foreground">
              {sessionResult.kind === "journal"
                ? `Saved ${sessionResult.species} to your journal`
                : sessionResult.message}
            </Text>
            {sessionResult.kind === "journal" && sessionResult.scientificName ? (
              <Text className="mt-1 font-serif-italic text-xs text-muted-foreground">
                {sessionResult.scientificName}
              </Text>
            ) : null}
          </View>
        ) : null}

        {status === "error" && errorMessage ? (
          <View className="mb-4 rounded-xl border border-border bg-card px-4 py-3">
            <Text className="font-sans-medium text-sm text-foreground">
              Could not save session
            </Text>
            <Text className="mt-1 font-sans text-xs text-muted-foreground">
              {errorMessage}
            </Text>
            <Pressable
              onPress={() => void retrySave()}
              className="mt-3 items-center rounded-lg border border-border py-2.5 active:opacity-90"
            >
              <Text className="font-sans-medium text-sm text-foreground">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {displayRows.length === 0 && listening ? (
          <Text className="py-8 text-center font-sans text-sm text-muted-foreground">
            Bird songs will appear here as Perch hears them…
          </Text>
        ) : null}

        {displayRows.length === 0 &&
        !listening &&
        (status === "idle" || status === "review") ? (
          <Text className="py-8 text-center font-sans text-sm text-muted-foreground">
            {status === "review"
              ? "Review your detections above, then save or discard."
              : "Point your phone toward a bird and tap listen."}
          </Text>
        ) : null}

        {(status === "listening" || status === "processing") &&
          displayRows.map(({ detection, isExpiring, isHeardNow }) => (
            <LiveSpeciesRow
              key={detection.key}
              detection={detection}
              isExpiring={isExpiring}
              highlighted={isHeardNow}
              showConfidence={SHOW_LIVE_SOUND_CONFIDENCE}
            />
          ))}
      </ScrollView>
    </View>
  );
}
