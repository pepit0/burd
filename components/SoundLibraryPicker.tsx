import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mic, X } from "lucide-react-native";
import { AudioPlayer } from "@/components/AudioPlayer";
import { getErrorMessage } from "@/lib/errors";
import { getAttachableSoundLibrary } from "@/lib/soundLibrary";
import {
  displayScientificName,
  displaySpeciesName,
} from "@/lib/predictionLabels";
import type { SoundLibraryEntry } from "@/types";

function entryLabel(entry: SoundLibraryEntry): string {
  if (entry.label?.trim()) return entry.label.trim();
  const top = entry.predictions[0];
  return top ? displaySpeciesName(top) : "Bird call";
}

interface SoundLibraryPickerProps {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
  onSelect: (entry: SoundLibraryEntry) => void;
}

export function SoundLibraryPicker({
  visible,
  userId,
  onClose,
  onSelect,
}: SoundLibraryPickerProps) {
  const [entries, setEntries] = useState<SoundLibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAttachableSoundLibrary(userId)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, userId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
          <Pressable onPress={onClose} className="p-1">
            <X size={22} color="#8a9e82" />
          </Pressable>
          <Text className="font-serif-semibold text-lg text-foreground">
            Attach bird call
          </Text>
          <View className="w-7" />
        </View>

        <ScrollView
          contentContainerClassName="gap-3 px-4 pb-12 pt-4"
          showsVerticalScrollIndicator={false}
        >
          <Text className="font-sans text-sm leading-relaxed text-muted-foreground">
            Pick a saved clip from your sound library. Only clips not already
            linked to a sighting are shown.
          </Text>

          {loading ? (
            <ActivityIndicator className="mt-12" color="#5f9470" />
          ) : error ? (
            <Text className="mt-12 text-center font-sans text-sm text-muted-foreground">
              {error}
            </Text>
          ) : entries.length === 0 ? (
            <View className="mt-12 items-center px-4">
              <Mic size={28} color="#3a4e35" />
              <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
                No saved clips available. Record from the camera mic or Sound ID
                first.
              </Text>
            </View>
          ) : (
            entries.map((entry) => {
              const top = entry.predictions[0];
              const scientific = top ? displayScientificName(top) : null;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => {
                    onSelect(entry);
                    onClose();
                  }}
                  className="gap-2 rounded-2xl border border-border bg-card p-4 active:opacity-90"
                >
                  <View>
                    <Text className="font-serif text-base text-foreground">
                      {entryLabel(entry)}
                    </Text>
                    {scientific ? (
                      <Text className="font-serif-italic text-xs text-muted-foreground">
                        {scientific}
                      </Text>
                    ) : null}
                    <Text className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                      {new Date(entry.recorded_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <AudioPlayer uri={entry.audio_url} durationMs={entry.duration_ms} />
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
