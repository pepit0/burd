import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { AudioTrimRangeBar } from "@/components/AudioTrimRangeBar";
import { PlaybackWaveform } from "@/components/PlaybackWaveform";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import {
  formatTrimDuration,
  normalizePostAudioTrim,
  type PostAudioTrim,
} from "@/lib/sightingAudio";

interface AudioTrimModalProps {
  visible: boolean;
  audioUrl: string;
  durationMs?: number;
  onCancel: () => void;
  onConfirm: (trim: PostAudioTrim | null) => void;
}

export function AudioTrimModal({
  visible,
  audioUrl,
  durationMs,
  onCancel,
  onConfirm,
}: AudioTrimModalProps) {
  const insets = useSafeAreaInsets();
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);

  const trimOptions = useMemo(
    () => ({
      trimStartMs: startMs,
      trimEndMs: endMs,
    }),
    [startMs, endMs],
  );

  const playback = useAudioPlayback(
    visible ? audioUrl : null,
    durationMs,
    trimOptions,
  );

  const fullDurationMs = playback.sourceDurationMs || durationMs || 0;
  const ready = fullDurationMs > 0 && !playback.peaksLoading;

  useEffect(() => {
    if (!visible) {
      setStartMs(0);
      setEndMs(0);
      return;
    }

    if (ready && endMs <= 0) {
      setStartMs(0);
      setEndMs(fullDurationMs);
    }
  }, [endMs, fullDurationMs, ready, visible]);

  useEffect(() => {
    if (!visible || !ready) return;
    setEndMs((current) => {
      if (current <= 0 || current > fullDurationMs) return fullDurationMs;
      return current;
    });
    setStartMs((current) => Math.max(0, Math.min(current, fullDurationMs - 1000)));
  }, [fullDurationMs, ready, visible]);

  function handleRangeChange(nextStart: number, nextEnd: number) {
    setStartMs(nextStart);
    setEndMs(nextEnd);
  }

  function handleConfirm() {
    onConfirm(normalizePostAudioTrim(startMs, endMs, fullDurationMs));
  }

  const selectedDurationMs = Math.max(0, endMs - startMs);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
          <Pressable onPress={onCancel} className="rounded-full p-2 active:bg-card">
            <X size={20} color="#8a9e82" />
          </Pressable>
          <Text className="font-serif-semibold text-base text-foreground">
            Trim for post
          </Text>
          <Pressable
            onPress={handleConfirm}
            disabled={!ready || selectedDurationMs <= 0}
            className={`rounded-full px-3 py-1.5 active:opacity-90 ${
              !ready || selectedDurationMs <= 0 ? "opacity-40" : "bg-primary"
            }`}
          >
            <Text className="font-sans-medium text-sm text-primary-foreground">Post</Text>
          </Pressable>
        </View>

        <View className="flex-1 gap-5 px-4 pt-5">
          <View className="rounded-2xl border border-border bg-card p-4">
            <Text className="font-sans-medium text-sm text-foreground">
              Choose the clip for your profile post
            </Text>
            <Text className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">
              Your journal keeps the full recording. If you remove the post later, you can trim
              again before sharing.
            </Text>
          </View>

          <View className="overflow-hidden rounded-2xl border border-border bg-muted/30">
            <PlaybackWaveform
              playback={playback}
              className="h-44 w-full"
              variant="hero"
              interactive
            />
          </View>

          {!ready ? (
            <View className="items-center py-4">
              <ActivityIndicator color="#5f9470" />
            </View>
          ) : (
            <AudioTrimRangeBar
              durationMs={fullDurationMs}
              startMs={startMs}
              endMs={endMs}
              peaks={playback.peaks}
              onChange={handleRangeChange}
            />
          )}

          <View className="rounded-xl border border-border bg-card px-4 py-3">
            <Text className="font-mono text-xs text-muted-foreground">
              Post clip: {formatTrimDuration(selectedDurationMs)}
              {fullDurationMs > 0
                ? ` · Full recording: ${formatTrimDuration(fullDurationMs)}`
                : ""}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
