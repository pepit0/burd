import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Pause, Play } from "lucide-react-native";
import { AudioScrubBar } from "@/components/AudioScrubBar";
import type { AudioPlaybackState } from "@/hooks/useAudioPlayback";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";

interface AudioPlayerProps {
  uri: string;
  durationMs?: number;
  compact?: boolean;
  playback?: AudioPlaybackState;
}

export function AudioPlayer({
  uri,
  durationMs,
  compact = false,
  playback: externalPlayback,
}: AudioPlayerProps) {
  const internalPlayback = useAudioPlayback(externalPlayback ? null : uri, durationMs);
  const playback = externalPlayback ?? internalPlayback;

  const activeLoading = playback.loading;
  const activePlaying = playback.playing;
  const activeDurationMs = playback.durationMs || durationMs || 0;
  const activeError = playback.error;
  const toggle = playback.toggle;

  if (compact) {
    return (
      <View className="gap-1">
        <View className="flex-row items-center gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-1.5">
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.();
              void toggle();
            }}
            className="active:opacity-80"
          >
            {activeLoading ? (
              <ActivityIndicator size="small" color="#5f9470" />
            ) : activePlaying ? (
              <Pause size={14} color="#5f9470" />
            ) : (
              <Play size={14} color="#5f9470" />
            )}
          </Pressable>
          <AudioScrubBar
            playback={playback}
            className="min-w-0 flex-1"
            showDuration
          />
        </View>
        {activeError ? (
          <Text className="font-sans text-[10px] text-red-400/90">{activeError}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="rounded-xl border border-border bg-card px-3 py-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={(event) => {
            event.stopPropagation?.();
            void toggle();
          }}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary/20 active:opacity-80"
        >
          {activeLoading ? (
            <ActivityIndicator size="small" color="#5f9470" />
          ) : activePlaying ? (
            <Pause size={18} color="#5f9470" />
          ) : (
            <Play size={18} color="#5f9470" />
          )}
        </Pressable>
        <View className="min-w-0 flex-1 gap-1">
          <AudioScrubBar playback={playback} showDuration />
          {activeError ? (
            <Text className="font-sans text-[10px] text-red-400/90">{activeError}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
