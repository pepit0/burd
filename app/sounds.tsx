import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, Mic, Plus, Trash2 } from "lucide-react-native";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/errors";
import {
  deleteSoundLibraryEntry,
  getMySoundLibrary,
} from "@/lib/soundLibrary";
import {
  displayScientificName,
  displaySpeciesName,
} from "@/lib/predictionLabels";
import type { SoundLibraryEntry } from "@/types";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function topSpeciesLabel(entry: SoundLibraryEntry): string {
  if (entry.label?.trim()) return entry.label.trim();
  const top = entry.predictions[0];
  if (!top) return "Bird call";
  return displaySpeciesName(top);
}

export default function SoundLibraryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [entries, setEntries] = useState<SoundLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const rows = await getMySoundLibrary(userId);
      setEntries(rows);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [userId, load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function logFromLibrary(entry: SoundLibraryEntry) {
    const top = entry.predictions[0];
    router.push({
      pathname: "/new-sighting",
      params: {
        source: top ? "audio" : "manual",
        species: top?.species ?? "",
        scientific_name: top?.scientific_name ?? "",
        confidence: top ? String(top.confidence) : "",
        sound_library_id: entry.id,
        audio_only: "1",
      },
    });
  }

  function confirmDelete(entry: SoundLibraryEntry) {
    Alert.alert(
      "Delete clip?",
      "This recording will be removed from your sound library.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSoundLibraryEntry(entry.id);
              setEntries((rows) => rows.filter((row) => row.id !== entry.id));
            } catch (e) {
              Alert.alert("Could not delete", getErrorMessage(e));
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Sound library" onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pb-28 pt-3"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#5f9470" />
        }
      >
        <Text className="font-sans text-sm leading-relaxed text-muted-foreground">
          Saved recordings from Live Sound ID or when you choose to keep a clip.
          Log them as audio-only sightings or attach when logging a photo.
        </Text>

        {loading && entries.length === 0 ? (
          <ActivityIndicator className="mt-16" color="#5f9470" />
        ) : error ? (
          <Text className="mt-16 text-center font-sans text-sm text-muted-foreground">
            {error}
          </Text>
        ) : entries.length === 0 ? (
          <View className="mt-16 items-center px-6">
            <Mic size={28} color="#3a4e35" />
            <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
              No saved clips yet. Tap + for Live Sound ID, or save a clip when
              logging from the camera.
            </Text>
          </View>
        ) : (
          entries.map((entry) => {
            const top = entry.predictions[0];
            const scientific = top ? displayScientificName(top) : null;
            return (
              <View
                key={entry.id}
                className="gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="font-serif text-base text-foreground">
                      {topSpeciesLabel(entry)}
                    </Text>
                    {scientific ? (
                      <Text className="font-serif-italic text-xs text-muted-foreground">
                        {scientific}
                      </Text>
                    ) : null}
                    <Text className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                      {formatWhen(entry.recorded_at)}
                      {entry.sighting_id ? " · linked to sighting" : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => confirmDelete(entry)}
                    className="rounded-full p-2 active:bg-muted"
                  >
                    <Trash2 size={16} color="#8a9e82" />
                  </Pressable>
                </View>

                <AudioPlayer uri={entry.audio_url} durationMs={entry.duration_ms} />

                {entry.predictions.length > 1 ? (
                  <Text className="font-sans text-xs text-muted-foreground">
                    {entry.predictions.length} species heard in this clip
                  </Text>
                ) : entry.predictions.length === 1 ? (
                  <Text className="font-sans text-xs text-muted-foreground">
                    1 species detected
                  </Text>
                ) : null}

                {!entry.sighting_id ? (
                  <Pressable
                    onPress={() => logFromLibrary(entry)}
                    className="flex-row items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 active:opacity-90"
                  >
                    <Text className="font-sans-medium text-sm text-foreground">
                      Save to journal
                    </Text>
                    <ChevronRight size={16} color="#5f9470" />
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/audio-id")}
        className="absolute bottom-6 right-5 h-[52px] w-[52px] items-center justify-center rounded-full bg-primary shadow-lg active:opacity-90"
      >
        <Plus size={20} color="#f0ead6" />
      </Pressable>
    </SafeAreaView>
  );
}
