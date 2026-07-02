import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { Pause, Play } from "lucide-react-native";
import type { AudioPlaybackState } from "@/hooks/useAudioPlayback";
import { PLAYBACK_BAR_COUNT } from "@/hooks/useAudioPlayback";

const MIN_BAR = 4;
const FRAME_PADDING_X = 20;
const FRAME_PADDING_TOP = 12;
const FRAME_PADDING_BOTTOM_INTERACTIVE = 30;
const FRAME_PADDING_BOTTOM = 8;

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function clampLevel(level: number): number {
  return Math.min(1, Math.max(0, level));
}

function barHeight(level: number, maxBarHeight: number): number {
  return Math.max(MIN_BAR, clampLevel(level) * maxBarHeight);
}

interface PlaybackWaveformProps {
  playback: AudioPlaybackState;
  className?: string;
  variant?: "hero" | "inline";
  interactive?: boolean;
}

export function PlaybackWaveform({
  playback,
  className = "",
  variant = "hero",
  interactive = false,
}: PlaybackWaveformProps) {
  const [frameHeight, setFrameHeight] = useState(0);
  const barCount = playback.peaks.length || PLAYBACK_BAR_COUNT;

  const idlePeaks = useMemo(() => {
    if (playback.peaks.length > 0) return playback.peaks;
    return Array.from({ length: barCount }, () => 0.2);
  }, [barCount, playback.peaks]);

  const paddingBottom = interactive ? FRAME_PADDING_BOTTOM_INTERACTIVE : FRAME_PADDING_BOTTOM;
  const maxBarHeight = Math.max(
    variant === "hero" ? 48 : 28,
    frameHeight - FRAME_PADDING_TOP - paddingBottom,
  );

  const timeLabel =
    playback.playing || playback.positionMs > 0
      ? formatDuration(playback.positionMs)
      : formatDuration(playback.durationMs || 0);

  const reactiveLevels =
    playback.liveLevels && playback.liveLevels.length > 0 ? playback.liveLevels : null;
  const showReactive =
    playback.playing || (reactiveLevels !== null && playback.positionMs > 0);

  function onFrameLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next !== frameHeight) {
      setFrameHeight(next);
    }
  }

  return (
    <View
      onLayout={onFrameLayout}
      className={`relative overflow-hidden bg-primary/8 ${className}`}
    >
      <View
        className="flex-1 justify-end"
        style={{
          paddingTop: FRAME_PADDING_TOP,
          paddingBottom,
          paddingHorizontal: FRAME_PADDING_X,
        }}
      >
        <View
          className="w-full flex-row items-end justify-center gap-[3px]"
          style={{ height: maxBarHeight, maxHeight: maxBarHeight, overflow: "hidden" }}
        >
          {playback.peaksLoading ? (
            <ActivityIndicator color="#5f9470" />
          ) : (
            Array.from({ length: barCount }, (_, index) => {
              const jitter = 0.55 + ((index * 7) % 11) / 22;
              let level: number;
              let opacity: number;

              if (showReactive && reactiveLevels) {
                const live = reactiveLevels[index] ?? 0;
                level = clampLevel(Math.max(0.1, live * 1.45) * jitter);
                opacity = playback.playing ? 1 : 0.88;
              } else {
                level = clampLevel((idlePeaks[index] ?? 0.2) * 0.85);
                opacity = 0.45;
              }

              const height = barHeight(level, maxBarHeight);

              return (
                <View
                  key={index}
                  className="h-full flex-1 items-center justify-end"
                  style={{ maxHeight: maxBarHeight }}
                >
                  <View
                    style={{
                      width: "100%",
                      height,
                      maxHeight: maxBarHeight,
                      borderRadius: 999,
                      backgroundColor: "#5f9470",
                      opacity,
                    }}
                  />
                </View>
              );
            })
          )}
        </View>
      </View>

      {interactive ? (
        <>
          <View
            className="absolute inset-0 z-10 items-center justify-center"
            pointerEvents="box-none"
          >
            <Pressable
              onPress={(event) => {
                event.stopPropagation?.();
                void playback.toggle();
              }}
              className="h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-background/85 active:opacity-90"
              accessibilityLabel={playback.playing ? "Pause bird call" : "Play bird call"}
            >
              {playback.loading ? (
                <ActivityIndicator size="small" color="#5f9470" />
              ) : playback.playing ? (
                <Pause size={18} color="#5f9470" />
              ) : (
                <View style={{ marginLeft: 2 }}>
                  <Play size={18} color="#5f9470" />
                </View>
              )}
            </Pressable>
          </View>

          <Text className="absolute bottom-2.5 right-3 z-10 font-mono text-[10px] text-muted-foreground">
            {timeLabel}
          </Text>

          {playback.error ? (
            <Text
              className="absolute bottom-2.5 left-3 z-10 max-w-[55%] font-sans text-[10px] text-red-400/90"
              numberOfLines={1}
            >
              {playback.error}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
