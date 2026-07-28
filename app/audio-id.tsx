import { useEffect, useRef } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BookOpen, Trash2, X } from "lucide-react-native";
import { LiveSoundControlBar } from "@/components/LiveSoundControlBar";
import { LiveSoundTipCarousel } from "@/components/LiveSoundTipCarousel";
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
  const showLiveList = listening;
  const reviewDetections = sessionReview?.sessionDetections ?? [];
  const selectedDetection =
    reviewDetections.find((detection) => detection.key === selectedPrimaryKey) ??
    sessionReview?.top ??
    null;
  const reviewPrimary = selectedDetection
    ? enrichPrediction(selectedDetection.prediction)
    : null;

  const showIdleTips = status === "idle" && micPermission === "granted";

  const listenHelperText = listening
    ? "Tap stop when you're done"
    : status === "review"
      ? "Review your session below"
      : status === "done"
        ? "Tap to listen again"
        : null;

  return (
    <View className="flex-1 bg-background">
      <View
        className="flex-row items-center justify-between px-4 pb-4"
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

      <View className="gap-1.5 px-4 pb-2">
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

        <View className="mt-3">
          <LiveSoundControlBar
            status={status}
            listening={listening}
            level={meteringLevel}
            saving={status === "saving"}
            disabled={status === "saving" || status === "review"}
            onPress={() => void handleListenPress()}
          />
        </View>

        <View className="flex-row items-center justify-between gap-2 px-0.5">
          <Text className="font-sans-medium text-sm text-primary">
            {statusLabel}
          </Text>
          {showIdleTips ? (
            <LiveSoundTipCarousel active inline />
          ) : listenHelperText ? (
            <Text className="shrink font-sans text-xs text-muted-foreground">
              {listenHelperText}
            </Text>
          ) : null}
        </View>

        {chunkWarning && (listening || status === "review") ? (
          <View className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
            <Text className="text-center font-sans text-xs leading-relaxed text-accent">
              {chunkWarning}
            </Text>
          </View>
        ) : null}
      </View>

      {showLiveList ? (
        <View className="min-h-0 flex-1 px-4">
          <Text className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Live detections
          </Text>
          <FlatList
            data={displayRows}
            keyExtractor={(row) => row.detection.key}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: bottomPad,
              flexGrow: 1,
              gap: 8,
            }}
            ListEmptyComponent={
              <Text className="py-6 text-center font-sans text-sm text-muted-foreground">
                Bird songs will appear here as Burd hears them…
              </Text>
            }
            renderItem={({ item: { detection, isExpiring, isHeardNow } }) => (
              <LiveSpeciesRow
                detection={detection}
                isExpiring={isExpiring}
                highlighted={isHeardNow}
                showConfidence={SHOW_LIVE_SOUND_CONFIDENCE}
              />
            )}
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-2 px-4"
          contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>
      )}
    </View>
  );
}
