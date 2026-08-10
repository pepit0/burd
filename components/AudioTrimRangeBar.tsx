import { useCallback, useMemo, useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { MIN_POST_AUDIO_TRIM_MS } from "@/lib/sightingAudio";

const TRIM_BAR_WIDTH = 3;
const TRIM_BAR_HIT_WIDTH = 22;
const TRIM_BAR_CAP_WIDTH = 10;

type ActiveHandle = "start" | "end" | null;

interface AudioTrimRangeBarProps {
  durationMs: number;
  startMs: number;
  endMs: number;
  peaks?: number[];
  onChange: (startMs: number, endMs: number) => void;
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

function pickHandle(
  x: number,
  trackWidth: number,
  startMs: number,
  endMs: number,
  durationMs: number,
): ActiveHandle {
  if (trackWidth <= 0 || durationMs <= 0) return "start";
  const startX = (startMs / durationMs) * trackWidth;
  const endX = (endMs / durationMs) * trackWidth;
  return Math.abs(x - startX) <= Math.abs(x - endX) ? "start" : "end";
}

function TrimEdgeBar({ active }: { active?: boolean }) {
  const color = active ? "#f0ead6" : "#eee8d4";
  return (
    <View className="h-full w-full items-center">
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: TRIM_BAR_WIDTH,
          borderRadius: 1,
          backgroundColor: color,
          shadowColor: "#000",
          shadowOpacity: active ? 0.28 : 0.18,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 0 },
          elevation: 2,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          width: TRIM_BAR_CAP_WIDTH,
          height: 3,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          width: TRIM_BAR_CAP_WIDTH,
          height: 3,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function AudioTrimRangeBar({
  durationMs,
  startMs,
  endMs,
  peaks = [],
  onChange,
}: AudioTrimRangeBarProps) {
  const trackWidthRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const durationRef = useRef(durationMs);
  const startRef = useRef(startMs);
  const endRef = useRef(endMs);
  const onChangeRef = useRef(onChange);
  const activeHandleRef = useRef<ActiveHandle>(null);
  const [activeHandle, setActiveHandle] = useState<ActiveHandle>(null);

  durationRef.current = durationMs;
  startRef.current = startMs;
  endRef.current = endMs;
  onChangeRef.current = onChange;

  const startRatio = durationMs > 0 ? startMs / durationMs : 0;
  const endRatio = durationMs > 0 ? endMs / durationMs : 1;
  const selectionLeft = startRatio * trackWidth;
  const selectionWidth = Math.max(0, (endRatio - startRatio) * trackWidth);

  const displayPeaks = useMemo(() => {
    if (peaks.length > 0) return peaks;
    return Array.from({ length: 24 }, () => 0.2);
  }, [peaks]);

  function onTrackLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    trackWidthRef.current = width;
    setTrackWidth(width);
  }

  const updateStart = useCallback((x: number) => {
    const width = trackWidthRef.current;
    const duration = durationRef.current;
    const end = endRef.current;
    const next = positionMsFromTrackX(x, width, duration);
    const clamped = Math.max(0, Math.min(next, end - MIN_POST_AUDIO_TRIM_MS));
    onChangeRef.current(clamped, end);
  }, []);

  const updateEnd = useCallback((x: number) => {
    const width = trackWidthRef.current;
    const duration = durationRef.current;
    const start = startRef.current;
    const next = positionMsFromTrackX(x, width, duration);
    const clamped = Math.max(
      start + MIN_POST_AUDIO_TRIM_MS,
      Math.min(next, duration),
    );
    onChangeRef.current(start, clamped);
  }, []);

  const clearActiveHandle = useCallback(() => {
    activeHandleRef.current = null;
    setActiveHandle(null);
  }, []);

  const handleTrackX = useCallback(
    (x: number) => {
      if (activeHandleRef.current === "end") {
        updateEnd(x);
      } else {
        updateStart(x);
      }
    },
    [updateEnd, updateStart],
  );

  const beginDrag = useCallback(
    (x: number) => {
      const width = trackWidthRef.current;
      const duration = durationRef.current;
      const start = startRef.current;
      const end = endRef.current;
      const handle = pickHandle(x, width, start, end, duration);
      activeHandleRef.current = handle;
      setActiveHandle(handle);
      if (handle === "end") {
        updateEnd(x);
      } else {
        updateStart(x);
      }
    },
    [updateEnd, updateStart],
  );

  const trackGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-4, 4])
        .failOffsetY([-16, 16])
        .shouldCancelWhenOutside(false)
        .onBegin((event) => {
          runOnJS(beginDrag)(event.x);
        })
        .onUpdate((event) => {
          runOnJS(handleTrackX)(event.x);
        })
        .onEnd(() => {
          runOnJS(clearActiveHandle)();
        }),
    [beginDrag, clearActiveHandle, handleTrackX],
  );

  return (
    <View className="gap-2">
      <GestureDetector gesture={trackGesture}>
        <View
          onLayout={onTrackLayout}
          className="relative h-16 justify-end overflow-hidden rounded-xl border border-border bg-muted/40 px-1 pb-2 pt-3"
        >
          <View className="h-10 flex-row items-end justify-center gap-[2px] px-2">
            {displayPeaks.map((peak, index) => {
              const barProgress = index / Math.max(1, displayPeaks.length - 1);
              const selected =
                barProgress >= startRatio - 0.01 && barProgress <= endRatio + 0.01;
              return (
                <View
                  key={index}
                  className="flex-1 items-end justify-end"
                  style={{ height: 40 }}
                >
                  <View
                    style={{
                      width: "100%",
                      height: Math.max(4, peak * 36),
                      borderRadius: 999,
                      backgroundColor: selected ? "#5f9470" : "#8a9e82",
                      opacity: selected ? 1 : 0.35,
                    }}
                  />
                </View>
              );
            })}
          </View>

          {trackWidth > 0 ? (
            <>
              {selectionLeft > 0 ? (
                <View
                  pointerEvents="none"
                  className="absolute bottom-2 top-3 bg-background/55"
                  style={{ left: 0, width: selectionLeft }}
                />
              ) : null}
              {selectionLeft + selectionWidth < trackWidth ? (
                <View
                  pointerEvents="none"
                  className="absolute bottom-2 top-3 bg-background/55"
                  style={{
                    left: selectionLeft + selectionWidth,
                    width: trackWidth - selectionLeft - selectionWidth,
                  }}
                />
              ) : null}
              <View
                pointerEvents="none"
                className="absolute bottom-2 top-3 border-y-2 border-primary/35 bg-primary/12"
                style={{ left: selectionLeft, width: selectionWidth }}
              />
              <View
                pointerEvents="none"
                className="absolute bottom-1 top-1 z-10"
                style={{
                  left: selectionLeft - TRIM_BAR_HIT_WIDTH / 2,
                  width: TRIM_BAR_HIT_WIDTH,
                }}
              >
                <TrimEdgeBar active={activeHandle === "start"} />
              </View>
              <View
                pointerEvents="none"
                className="absolute bottom-1 top-1 z-10"
                style={{
                  left: selectionLeft + selectionWidth - TRIM_BAR_HIT_WIDTH / 2,
                  width: TRIM_BAR_HIT_WIDTH,
                }}
              >
                <TrimEdgeBar active={activeHandle === "end"} />
              </View>
            </>
          ) : null}
        </View>
      </GestureDetector>
      <Text className="text-center font-mono text-[11px] text-muted-foreground">
        Drag the trim bars to set your post clip
      </Text>
    </View>
  );
}
