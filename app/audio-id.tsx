import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Mic, Square, X } from "lucide-react-native";
import { RarityBadge } from "@/components/RarityBadge";
import {
  MAX_AUDIO_CAPTURE_SECONDS,
  useAudioRecorder,
} from "@/hooks/useAudioRecorder";
import { getErrorMessage } from "@/lib/errors";
import { identifyAudio } from "@/lib/identify";
import {
  displayScientificName,
  displaySpeciesName,
} from "@/lib/predictionLabels";
import { lookupBaselineRarity } from "@/lib/speciesBaselines";
import {
  getCatalogSpeciesByScientificName,
  resolveCatalogSpecies,
} from "@/lib/speciesCatalog";
import type { Prediction } from "@/types";

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function PredictionRow({
  prediction,
  rank,
  onPress,
}: {
  prediction: Prediction;
  rank: number;
  onPress: () => void;
}) {
  const commonName = displaySpeciesName(prediction);
  const scientificName = displayScientificName(prediction);
  const rarity =
    lookupBaselineRarity(commonName, scientificName) ?? "common";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 active:opacity-90"
    >
      <Text className="w-5 font-mono text-xs text-muted-foreground">{rank}</Text>
      <View className="min-w-0 flex-1">
        <Text className="font-serif text-base text-foreground">{commonName}</Text>
        {scientificName ? (
          <Text className="font-serif-italic text-xs text-muted-foreground">
            {scientificName}
          </Text>
        ) : null}
        <View className="mt-1.5 flex-row items-center gap-2">
          <RarityBadge rarity={rarity} />
          <Text className="font-mono text-[10px] text-muted-foreground">
            {Math.round(prediction.confidence * 100)}% match
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color="#8a9e82" />
    </Pressable>
  );
}

export default function AudioIdentifyScreen() {
  const router = useRouter();
  const { isRecording, seconds, clip, startRecording, stopRecording, reset } =
    useAudioRecorder(MAX_AUDIO_CAPTURE_SECONDS);

  const [identifying, setIdentifying] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [identifyError, setIdentifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!clip?.uri) return;

    let cancelled = false;
    setIdentifying(true);
    setIdentifyError(null);
    setPredictions([]);

    identifyAudio(clip.uri)
      .then((result) => {
        if (!cancelled) {
          setPredictions(result.predictions);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setIdentifyError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setIdentifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clip?.uri]);

  async function handleRecordPress() {
    if (isRecording) {
      await stopRecording();
      return;
    }

    const started = await startRecording();
    if (!started) {
      Alert.alert(
        "Microphone access needed",
        "Allow microphone access so Burd can listen for bird calls.",
      );
    }
  }

  function openPrediction(prediction: Prediction) {
    const catalog = resolveCatalogSpecies(
      displaySpeciesName(prediction),
      displayScientificName(prediction),
    );
    if (catalog) {
      router.push(`/species/${catalog.id}`);
      return;
    }

    if (prediction.scientific_name) {
      const byScientific = getCatalogSpeciesByScientificName(
        prediction.scientific_name,
      );
      if (byScientific) {
        router.push(`/species/${byScientific.id}`);
      }
    }
  }

  function handleTryAgain() {
    reset();
    setPredictions([]);
    setIdentifyError(null);
  }

  const progress = Math.min(seconds / MAX_AUDIO_CAPTURE_SECONDS, 1);
  const showResults = Boolean(clip) && !isRecording;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-1">
          <X size={22} color="#8a9e82" />
        </Pressable>
        <Text className="font-serif-semibold text-lg text-foreground">
          Sound ID
        </Text>
        <View className="w-7" />
      </View>

      <ScrollView
        contentContainerClassName="gap-5 px-4 pb-12 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-4 rounded-2xl border border-border bg-card p-6">
          <View className="h-28 w-28 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <Mic size={34} color="#5f9470" />
          </View>

          <View className="items-center gap-1">
            <Text className="font-serif-semibold text-lg text-foreground">
              {isRecording
                ? "Listening…"
                : showResults
                  ? "Capture complete"
                  : "Record a bird call"}
            </Text>
            <Text className="text-center font-sans text-sm leading-relaxed text-muted-foreground">
              {isRecording
                ? `Perch is listening · max ${MAX_AUDIO_CAPTURE_SECONDS}s`
                : showResults
                  ? "Perch analyzed your clip. Tap a match to open the field guide."
                  : "Hold still near the bird and record up to 30 seconds."}
            </Text>
          </View>

          <View className="w-full gap-2">
            <View className="h-1.5 overflow-hidden rounded-full bg-muted">
              <View
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${isRecording || showResults ? progress * 100 : 0}%`,
                }}
              />
            </View>
            <Text className="text-center font-mono text-xs text-muted-foreground">
              {formatTimer(isRecording || showResults ? seconds : 0)} /{" "}
              {formatTimer(MAX_AUDIO_CAPTURE_SECONDS)}
            </Text>
          </View>

          {!showResults || identifying ? (
            <Pressable
              onPress={() => void handleRecordPress()}
              disabled={identifying}
              className={`flex-row items-center justify-center gap-2 rounded-xl px-5 py-3.5 active:opacity-90 ${
                isRecording ? "bg-accent" : "bg-primary"
              }`}
            >
              {identifying ? (
                <ActivityIndicator color="#f0ead6" />
              ) : isRecording ? (
                <>
                  <Square size={16} color="#f0ead6" fill="#f0ead6" />
                  <Text className="font-sans-medium text-sm text-primary-foreground">
                    Stop recording
                  </Text>
                </>
              ) : (
                <>
                  <Mic size={16} color="#f0ead6" />
                  <Text className="font-sans-medium text-sm text-primary-foreground">
                    Start recording
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleTryAgain}
              className="items-center rounded-xl border border-border bg-background px-5 py-3.5 active:opacity-90"
            >
              <Text className="font-sans-medium text-sm text-foreground">
                Record again
              </Text>
            </Pressable>
          )}
        </View>

        {identifying ? (
          <View className="items-center py-4">
            <ActivityIndicator color="#5f9470" />
            <Text className="mt-2 font-sans text-xs text-muted-foreground">
              Perch is identifying your recording…
            </Text>
          </View>
        ) : null}

        {identifyError ? (
          <Text className="text-center font-sans text-sm text-muted-foreground">
            {identifyError}
          </Text>
        ) : null}

        {showResults && !identifying && predictions.length > 0 ? (
          <View className="gap-3">
            <Text className="font-sans-medium text-sm text-foreground">
              Perch thinks it&apos;s…
            </Text>
            {predictions.map((prediction, index) => (
              <PredictionRow
                key={`${prediction.species}-${index}`}
                prediction={prediction}
                rank={index + 1}
                onPress={() => openPrediction(prediction)}
              />
            ))}
          </View>
        ) : null}

        {showResults && !identifying && !identifyError && predictions.length === 0 ? (
          <Text className="text-center font-sans text-sm text-muted-foreground">
            No confident matches. Try recording again closer to the bird.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
