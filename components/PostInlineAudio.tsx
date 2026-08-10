import { ActivityIndicator, Pressable, View } from "react-native";
import { Pause, Play } from "lucide-react-native";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { PLAYBACK_BAR_COUNT } from "@/hooks/useAudioPlayback";
import type { AudioPlaybackTrimOptions } from "@/lib/sightingAudio";

interface PostInlineAudioProps {
  audioUrl: string;
  trimOptions?: AudioPlaybackTrimOptions;
  className?: string;
  deferLoad?: boolean;
}

const MIN_BAR = 3;

function InlineWaveform({
  peaks,
  playing,
}: {
  peaks: number[];
  playing: boolean;
}) {
  const barCount = peaks.length || PLAYBACK_BAR_COUNT;
  const levels = peaks.length > 0 ? peaks : Array.from({ length: barCount }, () => 0.25);

  return (
    <View className="h-6 min-w-0 flex-1 flex-row items-end gap-[2px]">
      {levels.slice(0, 28).map((level, index) => {
        const jitter = 0.55 + ((index * 7) % 11) / 22;
        const height = Math.max(MIN_BAR, Math.min(22, level * jitter * 22 * (playing ? 1.1 : 0.85)));
        return (
          <View
            key={index}
            className="flex-1 rounded-full bg-foreground/90"
            style={{ height, opacity: playing ? 1 : 0.65 }}
          />
        );
      })}
    </View>
  );
}

export function PostInlineAudio({
  audioUrl,
  trimOptions,
  className = "",
  deferLoad = false,
}: PostInlineAudioProps) {
  const playback = useAudioPlayback(
    audioUrl,
    undefined,
    deferLoad ? { ...trimOptions, deferLoad: true } : trimOptions,
  );

  return (
    <View className={`min-w-0 flex-1 flex-row items-center gap-2 ${className}`}>
      <Pressable
        onPress={(event) => {
          event.stopPropagation?.();
          void playback.toggle();
        }}
        className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary active:opacity-90"
        accessibilityLabel={playback.playing ? "Pause bird call" : "Play bird call"}
      >
        {playback.loading ? (
          <ActivityIndicator size="small" color="#f0ead6" />
        ) : playback.playing ? (
          <Pause size={16} color="#f0ead6" />
        ) : (
          <View style={{ marginLeft: 2 }}>
            <Play size={16} color="#f0ead6" />
          </View>
        )}
      </Pressable>
      <InlineWaveform peaks={playback.peaks} playing={playback.playing} />
    </View>
  );
}
