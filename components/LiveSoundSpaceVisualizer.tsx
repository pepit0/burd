import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline, Rect } from "react-native-svg";
import { LiveSoundFeatureStream } from "@/lib/liveSoundFeatures";

const FREQ_BINS = 24;
const FREQ_LABELS = ["4k", "2k", "0"] as const;
const AXIS_WIDTH = 30;
const STRIP_HEIGHT = 52;
const WAVE_BARS = 48;
const PANEL_PAD = 8;
const STRIP_GAP = 4;

interface LiveSoundSpaceVisualizerProps {
  level: number;
  /** Live mic updates while recording. */
  active: boolean;
  /** Keep showing the last capture until the session is cleared. */
  visible: boolean;
}

/** Green heat ramp aligned with Burd primary (#5f9470). */
function specColor(energy: number): string {
  const t = Math.max(0, Math.min(1, energy));
  const r = Math.round(24 + t * 71);
  const g = Math.round(42 + t * 106);
  const b = Math.round(32 + t * 48);
  return `rgba(${r}, ${g}, ${b}, ${0.32 + t * 0.68})`;
}

function waveBarColor(amp: number): string {
  const t = Math.max(0, Math.min(1, amp));
  return `rgba(${Math.round(60 + t * 35)}, ${Math.round(110 + t * 38)}, ${Math.round(
    78 + t * 22,
  )}, ${0.45 + t * 0.55})`;
}

export function LiveSoundSpaceVisualizer({
  level,
  active,
  visible,
}: LiveSoundSpaceVisualizerProps) {
  const streamRef = useRef(new LiveSoundFeatureStream(FREQ_BINS));
  const startedAtRef = useRef<number | null>(null);
  const [sampleHz, setSampleHz] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [frame, setFrame] = useState(0);
  const [panelWidth, setPanelWidth] = useState(0);

  const plotWidth = Math.max(
    0,
    panelWidth - PANEL_PAD * 2 - AXIS_WIDTH - STRIP_GAP,
  );

  useEffect(() => {
    if (!visible) {
      streamRef.current.reset();
      setSampleHz(0);
      setElapsedSec(0);
      setFrame(0);
      startedAtRef.current = null;
      return;
    }

    if (!active) {
      if (startedAtRef.current != null) {
        setElapsedSec((Date.now() - startedAtRef.current) / 1000);
      }
      return;
    }

    const sample = streamRef.current.push(level);
    setSampleHz(sample.hz);
    setFrame((tick) => tick + 1);
  }, [visible, active, level]);

  useEffect(() => {
    if (!visible || !active) return;
    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now();
    }
    const timer = setInterval(() => {
      if (startedAtRef.current == null) return;
      setElapsedSec((Date.now() - startedAtRef.current) / 1000);
    }, 250);
    return () => clearInterval(timer);
  }, [visible, active]);

  const levels = streamRef.current.getLevels();
  const columns = streamRef.current.getColumns();
  void frame;

  const hasCapture = columns.length > 0 || startedAtRef.current != null;

  const cellW = plotWidth / Math.max(columns.length, 1);
  const cellH = STRIP_HEIGHT / FREQ_BINS;
  const waveSamples = levels.slice(-WAVE_BARS);

  const wavePoints = useMemo(() => {
    const samples = streamRef.current.getLevels().slice(-WAVE_BARS);
    if (samples.length < 2) return "";
    const midY = STRIP_HEIGHT / 2;
    const step = plotWidth / Math.max(samples.length - 1, 1);
    return samples
      .map((amp, index) => {
        const x = index * step;
        const y = midY - amp * (STRIP_HEIGHT * 0.42);
        return `${x},${y}`;
      })
      .join(" ");
  }, [plotWidth, frame]);

  if (!visible) return null;

  return (
    <View style={styles.wrap} accessibilityLabel="Live audio spectrogram">
      <View style={styles.readoutRow}>
        <Text className="font-mono text-sm text-primary">
          {active
            ? sampleHz > 0
              ? `${sampleHz.toFixed(0)} Hz`
              : "Listening…"
            : hasCapture
              ? sampleHz > 0
                ? `${sampleHz.toFixed(0)} Hz`
                : "Session capture"
              : "Ready to listen"}
        </Text>
        <Text className="font-mono text-xs text-muted-foreground">
          {active || hasCapture
            ? `${elapsedSec.toFixed(0)} s${active ? "" : " · recorded"}`
            : "0 s"}
        </Text>
      </View>

      <View
        style={styles.panel}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth !== panelWidth) setPanelWidth(nextWidth);
        }}
      >
        <View style={styles.stripRow}>
          <View style={[styles.freqAxis, { height: STRIP_HEIGHT }]}>
            {FREQ_LABELS.map((label) => (
              <Text key={label} className="font-mono text-[8px] text-muted-foreground/75">
                {label}
              </Text>
            ))}
          </View>

          <View style={[styles.plotClip, { width: plotWidth, height: STRIP_HEIGHT }]}>
            {plotWidth > 0 ? (
            <Svg width={plotWidth} height={STRIP_HEIGHT}>
              <Rect
                x={0}
                y={0}
                width={plotWidth}
                height={STRIP_HEIGHT}
                fill="#0e130e"
              />
              <Line
                x1={0}
                y1={STRIP_HEIGHT / 2}
                x2={plotWidth}
                y2={STRIP_HEIGHT / 2}
                stroke="rgba(138, 158, 130, 0.14)"
                strokeWidth={1}
              />

              {columns.map((bins, colIndex) =>
                bins.map((energy, binIndex) => {
                  if (energy <= 0) return null;
                  const x = colIndex * cellW;
                  if (x >= plotWidth) return null;
                  const w = Math.min(Math.max(1, cellW - 0.15), plotWidth - x);
                  return (
                    <Rect
                      key={`${colIndex}-${binIndex}`}
                      x={x}
                      y={STRIP_HEIGHT - (binIndex + 1) * cellH}
                      width={w}
                      height={cellH + 0.15}
                      fill={specColor(energy)}
                    />
                  );
                }),
              )}
            </Svg>
            ) : null}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.stripRow}>
          <View style={[styles.axisLabel, { height: STRIP_HEIGHT }]}>
            <Text className="font-mono text-[8px] text-muted-foreground/70">lvl</Text>
          </View>
          <View style={[styles.plotClip, { width: plotWidth, height: STRIP_HEIGHT }]}>
            {plotWidth > 0 ? (
            <Svg width={plotWidth} height={STRIP_HEIGHT}>
              <Rect
                x={0}
                y={0}
                width={plotWidth}
                height={STRIP_HEIGHT}
                fill="#0e130e"
              />
              <Line
                x1={0}
                y1={STRIP_HEIGHT / 2}
                x2={plotWidth}
                y2={STRIP_HEIGHT / 2}
                stroke="rgba(138, 158, 130, 0.2)"
                strokeWidth={1}
              />

              {waveSamples.map((amp, index) => {
                const barW = plotWidth / WAVE_BARS;
                const h = Math.max(2, amp * STRIP_HEIGHT * 0.88);
                const x = index * barW;
                const y = (STRIP_HEIGHT - h) / 2;
                return (
                  <Rect
                    key={`wave-${index}`}
                    x={x + barW * 0.12}
                    y={y}
                    width={Math.max(1.5, barW * 0.76)}
                    height={h}
                    rx={1}
                    fill={waveBarColor(amp)}
                  />
                );
              })}

              {wavePoints ? (
                <Polyline
                  points={wavePoints}
                  fill="none"
                  stroke="rgba(168, 212, 180, 0.55)"
                  strokeWidth={1.25}
                />
              ) : null}
            </Svg>
            ) : null}
          </View>
        </View>

        <Text className="mt-1.5 pr-1 text-right font-mono text-[8px] text-muted-foreground/65">
          Time →
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: 8,
    marginBottom: 10,
  },
  readoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 2,
  },
  panel: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(95, 148, 112, 0.28)",
    backgroundColor: "#121712",
    paddingVertical: 10,
    paddingHorizontal: PANEL_PAD,
    overflow: "hidden",
  },
  stripRow: {
    flexDirection: "row",
    gap: STRIP_GAP,
    alignItems: "center",
  },
  plotClip: {
    overflow: "hidden",
    borderRadius: 4,
  },
  freqAxis: {
    width: AXIS_WIDTH,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 1,
    paddingRight: 2,
  },
  axisLabel: {
    width: AXIS_WIDTH,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(138, 158, 130, 0.22)",
    marginVertical: 8,
    marginLeft: AXIS_WIDTH + STRIP_GAP,
  },
});
