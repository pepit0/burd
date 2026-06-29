import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, Mic, Sparkles, X } from "lucide-react-native";
import { AudioPlayer } from "@/components/AudioPlayer";
import { useAuth } from "@/hooks/useAuth";
import { getUserFacingMessage } from "@/lib/errors";
import { detectionSourceLabel } from "@/lib/fusePredictions";
import {
  setPendingCapture,
  takePendingCapture,
  type PendingCapture,
} from "@/lib/pendingCapture";
import {
  displayScientificName,
  displaySpeciesName,
  enrichPrediction,
} from "@/lib/predictionLabels";
import { deleteSoundLibraryEntry, saveSoundToLibrary } from "@/lib/soundLibrary";
import { soundReportSpecies } from "@/lib/heardSpecies";

function HeardSpeciesRow({
  species,
  scientificName,
  confidence,
}: {
  species: string;
  scientificName: string | null;
  confidence: number;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
      <Mic size={16} color="#5f9470" />
      <View className="min-w-0 flex-1">
        <Text className="font-serif text-base text-foreground">{species}</Text>
        {scientificName ? (
          <Text className="font-serif-italic text-xs text-muted-foreground">
            {scientificName}
          </Text>
        ) : null}
      </View>
      <Text className="font-mono text-[10px] text-muted-foreground">
        {Math.round(confidence * 100)}%
      </Text>
    </View>
  );
}

export default function SoundReviewScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [capture, setCapture] = useState<PendingCapture | null>(null);
  const [saving, setSaving] = useState(false);
  const [soundLibraryId, setSoundLibraryId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const pending = takePendingCapture();
    if (!pending?.audio) {
      router.replace("/(tabs)/journal");
      return;
    }
    setPendingCapture(pending);
    setCapture(pending);
    if (pending.soundLibraryId) {
      setSoundLibraryId(pending.soundLibraryId);
    }
  }, [router]);

  function continueToLog() {
    if (!capture) return;
    const analysis = capture.analysis;
    const top = analysis?.top ? enrichPrediction(analysis.top) : null;

    setPendingCapture({
      ...capture,
      soundLibraryId: soundLibraryId ?? capture.soundLibraryId ?? null,
    });

    const sharedParams = {
      source: analysis?.detectedBy ?? "audio",
      species: top?.species ?? "",
      scientific_name: top?.scientific_name ?? "",
      confidence: top ? String(top.confidence) : "",
      audio_agreed: analysis?.agreed ? "1" : "0",
      ...(soundLibraryId ? { sound_library_id: soundLibraryId } : {}),
    };

    if (capture.photos.length > 0) {
      router.replace({
        pathname: "/new-sighting",
        params: {
          ...sharedParams,
          count: String(analysis?.count ?? 1),
        },
      });
      return;
    }

    router.replace({
      pathname: "/new-sighting",
      params: {
        ...sharedParams,
        audio_only: "1",
      },
    });
  }

  async function saveToLibrary() {
    if (!capture?.audio || !userId || soundLibraryId || saving) return;

    setSaving(true);
    setSaveError(null);
    try {
      const entry = await saveSoundToLibrary(userId, {
        localUri: capture.audio.uri,
        durationMs: capture.audio.durationMs,
        recordedAt: capture.audio.recordedAt,
        predictions: soundReportSpecies(capture.analysis),
      });
      setSoundLibraryId(entry.id);
      setPendingCapture({ ...capture, soundLibraryId: entry.id });
    } catch (e) {
      setSaveError(
        getUserFacingMessage(e, "Couldn't save this clip. Please try again."),
      );
    } finally {
      setSaving(false);
    }
  }

  function discardRecording() {
    Alert.alert(
      "Discard recording?",
      soundLibraryId
        ? "This clip will be removed from your sound library."
        : "Your recording will be discarded.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            if (soundLibraryId) {
              try {
                await deleteSoundLibraryEntry(soundLibraryId);
              } catch {
                // best effort
              }
            }
            setPendingCapture(null);
            router.back();
          },
        },
      ],
    );
  }

  if (!capture?.audio) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#5f9470" />
      </SafeAreaView>
    );
  }

  const analysis = capture.analysis;
  const heard = soundReportSpecies(analysis);
  const identifyUnavailable = !analysis;
  const primaryPhoto = capture.photos[capture.primaryIndex] ?? capture.photos[0];
  const photoTop = analysis?.imagePredictions[0] ?? null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-1">
          <X size={22} color="#8a9e82" />
        </Pressable>
        <Text className="font-serif-semibold text-lg text-foreground">
          Sound report
        </Text>
        <View className="w-7" />
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-12 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-2xl border border-border bg-card p-4">
          <View className="mb-3 flex-row items-center gap-2">
            <Sparkles size={16} color="#5f9470" />
            <Text className="font-sans-medium text-sm text-foreground">
              {identifyUnavailable
                ? "Perch couldn't analyze this clip"
                : heard.length === 1
                  ? "Perch heard 1 species"
                  : heard.length > 1
                    ? `Perch heard ${heard.length} species in this clip`
                    : "No bird calls detected"}
            </Text>
          </View>

          <AudioPlayer
            uri={capture.audio.uri}
            durationMs={capture.audio.durationMs}
          />
          {soundLibraryId ? (
            <Text className="mt-3 font-sans text-xs text-muted-foreground">
              Saved to your sound library
            </Text>
          ) : (
            <Text className="mt-3 font-sans text-xs text-muted-foreground">
              Not saved yet — log the sighting or tap Save to library if you
              want to keep this clip.
            </Text>
          )}
        </View>

        {heard.length > 0 ? (
          <View className="gap-2">
            <Text className="font-sans-medium text-sm text-foreground">
              Species heard
            </Text>
            {heard.map((prediction, index) => (
              <HeardSpeciesRow
                key={`${prediction.species}-${index}`}
                species={displaySpeciesName(prediction)}
                scientificName={displayScientificName(prediction)}
                confidence={prediction.confidence}
              />
            ))}
          </View>
        ) : identifyUnavailable ? (
          <Text className="font-sans text-sm text-muted-foreground">
            We couldn&apos;t reach Perch for this recording. You can still log
            the sighting or save the clip.
          </Text>
        ) : (
          <Text className="font-sans text-sm text-muted-foreground">
            No bird calls detected. You can still log the sighting or save the
            clip if you want it.
          </Text>
        )}

        {primaryPhoto && photoTop ? (
          <View className="gap-2">
            <Text className="font-sans-medium text-sm text-foreground">
              Photo match
            </Text>
            <View className="flex-row gap-3 rounded-xl border border-border bg-card p-3">
              <Image
                source={{ uri: primaryPhoto.uri }}
                className="h-16 w-16 rounded-lg bg-muted"
                resizeMode="cover"
              />
              <View className="min-w-0 flex-1 justify-center">
                <Text className="font-serif text-base text-foreground">
                  {displaySpeciesName(photoTop)}
                </Text>
                {photoTop.scientific_name ? (
                  <Text className="font-serif-italic text-xs text-muted-foreground">
                    {photoTop.scientific_name}
                  </Text>
                ) : null}
                <Text className="mt-1 font-sans text-xs text-muted-foreground">
                  {Math.round(photoTop.confidence * 100)}% ·{" "}
                  {detectionSourceLabel(analysis?.detectedBy ?? "image")}
                  {analysis?.agreed ? " · sound agrees" : ""}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={continueToLog}
          className="mt-2 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-90"
        >
          <Check size={16} color="#f0ead6" />
          <Text className="font-sans-bold text-base text-primary-foreground">
            {capture.photos.length > 0 ? "Log sighting" : "Log sound sighting"}
          </Text>
        </Pressable>

        {!soundLibraryId ? (
          <Pressable
            onPress={() => void saveToLibrary()}
            disabled={saving}
            className={`items-center rounded-xl border border-border bg-card py-3.5 active:opacity-80 ${
              saving ? "opacity-60" : ""
            }`}
          >
            {saving ? (
              <ActivityIndicator color="#5f9470" />
            ) : (
              <Text className="font-sans-medium text-sm text-foreground">
                Save to library
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.replace("/sounds")}
            className="items-center rounded-xl border border-border bg-card py-3.5 active:opacity-80"
          >
            <Text className="font-sans-medium text-sm text-foreground">
              Open sound library
            </Text>
          </Pressable>
        )}

        {saveError ? (
          <Text className="text-center font-sans text-xs text-red-400/90">
            {saveError}
          </Text>
        ) : null}

        <Pressable
          onPress={() => void discardRecording()}
          className="items-center py-2 active:opacity-70"
        >
          <Text className="font-sans text-sm text-muted-foreground">
            Discard recording
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
