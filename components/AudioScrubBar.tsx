import { useCallback, useMemo, useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import type { AudioPlaybackState } from "@/hooks/useAudioPlayback";

const THUMB_SIZE = 16;
const TRACK_HEIGHT = 4;

interface AudioScrubBarProps {
  playback: AudioPlaybackState;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  showTimestamp?: boolean;
  showDuration?: boolean;
  variant?: "default" | "overlay";
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function positionMsFromTrackX(
  x: number,
  trackWidth: number,
  durationMs: number,
): number {
  if (trackWidth <= 0 || durationMs <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, x / trackWidth));
  return ratio * durationMs;
}

export function AudioScrubBar({
  playback,
  className = "",
  trackClassName = "rounded-full bg-muted",
  fillClassName = "h-full rounded-full bg-primary",
  showTimestamp = true,
  showDuration = false,
  variant = "default",
}: AudioScrubBarProps) {
  const trackWidthRef = useRef(0);
  const durationRef = useRef(0);
  const seekRef = useRef(playback.seekTo);
  const [trackWidth, setTrackWidth] = useState(0);
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  durationRef.current = playback.durationMs || 0;
  seekRef.current = playback.seekTo;

  const displayMs = scrubMs ?? playback.positionMs;
  const durationMs = durationRef.current;
  const progress =
    durationMs > 0 ? Math.min(1, Math.max(0, displayMs / durationMs)) : 0;
  const thumbLeft = progress * trackWidth - THUMB_SIZE / 2;

  const updateScrubX = useCallback((x: number) => {
    setDragging(true);
    setScrubMs(
      positionMsFromTrackX(x, trackWidthRef.current, durationRef.current),
    );
  }, []);

  const finishScrubX = useCallback((x: number) => {
    const ms = positionMsFromTrackX(
      x,
      trackWidthRef.current,
      durationRef.current,
    );
    setDragging(false);
    setScrubMs(null);
    void seekRef.current(ms);
  }, []);

  const scrubGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-18, 18])
      .shouldCancelWhenOutside(false)
      .onBegin((event) => {
        runOnJS(updateScrubX)(event.x);
      })
      .onUpdate((event) => {
        runOnJS(updateScrubX)(event.x);
      })
      .onEnd((event) => {
        runOnJS(finishScrubX)(event.x);
      });

    const tapGesture = Gesture.Tap().onEnd((event) => {
      runOnJS(finishScrubX)(event.x);
    });

    return Gesture.Exclusive(panGesture, tapGesture);
  }, [updateScrubX, finishScrubX]);

  function onTrackLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    trackWidthRef.current = width;
    setTrackWidth(width);
  }

  const timestampClassName =
    variant === "overlay"
      ? "w-9 font-mono text-[10px] text-muted-foreground"
      : "w-10 font-mono text-[10px] text-muted-foreground";

  return (
    <View className={`flex-row items-center gap-2 ${className}`}>
      {showTimestamp ? (
        <Text className={timestampClassName}>
          {formatDuration(displayMs)}
        </Text>
      ) : null}

      <GestureDetector gesture={scrubGesture}>
        <View className="relative min-h-[36px] flex-1 justify-center">
          <View
            onLayout={onTrackLayout}
            className={`relative justify-center ${trackClassName}`}
            style={{ height: TRACK_HEIGHT }}
          >
            <View
              className={fillClassName}
              style={{ width: `${progress * 100}%`, height: TRACK_HEIGHT }}
            />
          </View>

          {durationMs > 0 && trackWidth > 0 ? (
            <View
              pointerEvents="none"
              className="absolute top-1/2"
              style={{
                left: Math.max(0, Math.min(trackWidth - THUMB_SIZE, thumbLeft)),
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                marginTop: -THUMB_SIZE / 2,
                borderRadius: THUMB_SIZE / 2,
                backgroundColor: "#5f9470",
                borderWidth: 2,
                borderColor: variant === "overlay" ? "#f0ead6" : "#ffffff",
                transform: [{ scale: dragging ? 1.15 : 1 }],
                shadowColor: "#000",
                shadowOpacity: dragging ? 0.2 : 0.12,
                shadowRadius: dragging ? 4 : 2,
                shadowOffset: { width: 0, height: 1 },
                elevation: dragging ? 3 : 1,
              }}
            />
          ) : null}
        </View>
      </GestureDetector>

      {showDuration ? (
        <Text className="w-10 text-right font-mono text-[10px] text-muted-foreground">
          {formatDuration(durationMs)}
        </Text>
      ) : null}
    </View>
  );
}
