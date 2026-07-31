import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline, Rect } from "react-native-svg";
import { runAnimationFrameLoop, smoothStep } from "@/lib/animationFrameLoop";
import { LiveSoundFeatureStream, MAX_SPEC_COLUMNS } from "@/lib/liveSoundFeatures";

const FREQ_BINS = 24;
const STRIP_HEIGHT = 52;
const WAVE_BARS = 48;
const PANEL_PAD_X = 10;
const PANEL_PAD_Y = 10;
const AXIS_LABEL_HEIGHT = 10;
const AXIS_LABEL_INSET = 4;
/** New spectrogram column cadence — keeps heatmap smooth without 60 cols/sec. */
const SPEC_COLUMN_MS = 33;

const FREQ_LABEL_TOP = 0;
const FREQ_LABEL_MID = STRIP_HEIGHT / 2 - AXIS_LABEL_HEIGHT / 2;
const FREQ_LABEL_BOTTOM = STRIP_HEIGHT - AXIS_LABEL_HEIGHT;

interface LiveSoundSpaceVisualizerProps {
  levelRef: MutableRefObject<number>;
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

const SpectrogramStrip = memo(function SpectrogramStrip({
  columns,
  plotWidth,
  revision,
}: {
  columns: readonly number[][];
  plotWidth: number;
  revision: number;
}) {
  void revision;
  const visibleColumns = columns.slice(-MAX_SPEC_COLUMNS);
  const cellW = plotWidth / Math.max(visibleColumns.length, 1);
  const cellH = STRIP_HEIGHT / FREQ_BINS;

  if (plotWidth <= 0) return null;

  return (
    <Svg width={plotWidth} height={STRIP_HEIGHT}>
      <Rect x={0} y={0} width={plotWidth} height={STRIP_HEIGHT} fill="#0e130e" />
      <Line
        x1={0}
        y1={STRIP_HEIGHT / 2}
        x2={plotWidth}
        y2={STRIP_HEIGHT / 2}
        stroke="rgba(138, 158, 130, 0.14)"
        strokeWidth={1}
      />
      {visibleColumns.map((bins, colIndex) =>
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
  );
});

const WaveformStrip = memo(function WaveformStrip({
  waveSamples,
  wavePoints,
  plotWidth,
  revision,
}: {
  waveSamples: readonly number[];
  wavePoints: string;
  plotWidth: number;
  revision: number;
}) {
  void revision;
  if (plotWidth <= 0) return null;

  const barW = plotWidth / WAVE_BARS;

  return (
    <Svg width={plotWidth} height={STRIP_HEIGHT}>
      <Rect x={0} y={0} width={plotWidth} height={STRIP_HEIGHT} fill="#0e130e" />
      <Line
        x1={0}
        y1={STRIP_HEIGHT / 2}
        x2={plotWidth}
        y2={STRIP_HEIGHT / 2}
        stroke="rgba(138, 158, 130, 0.2)"
        strokeWidth={1}
      />
      {waveSamples.map((amp, index) => {
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
  );
});

function PlotAxisOverlay({ labels }: { labels: readonly { text: string; top: number }[] }) {
  return (
    <View style={styles.axisOverlay} pointerEvents="none">
      {labels.map(({ text, top }) => (
        <Text key={text} style={[styles.axisLabelText, { top }]}>
          {text}
        </Text>
      ))}
    </View>
  );
}

export function LiveSoundSpaceVisualizer({
  levelRef,
  active,
  visible,
}: LiveSoundSpaceVisualizerProps) {
  const streamRef = useRef(new LiveSoundFeatureStream(FREQ_BINS));
  const startedAtRef = useRef<number | null>(null);
  const displayLevelRef = useRef(0);
  const [sampleHz, setSampleHz] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [waveFrame, setWaveFrame] = useState(0);
  const [specFrame, setSpecFrame] = useState(0);
  const [plotWidth, setPlotWidth] = useState(0);

  const handlePlotLayout = (width: number) => {
    if (width > 0 && width !== plotWidth) setPlotWidth(width);
  };

  useEffect(() => {
    if (!visible) {
      streamRef.current.reset();
      displayLevelRef.current = 0;
      setSampleHz(0);
      setElapsedSec(0);
      setWaveFrame(0);
      setSpecFrame(0);
      startedAtRef.current = null;
      return;
    }

    if (!active) {
      if (startedAtRef.current != null) {
        setElapsedSec((Date.now() - startedAtRef.current) / 1000);
      }
      return;
    }

    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now();
    }

    let specAccumulator = 0;
    let elapsedAccumulator = 0;

    const cancel = runAnimationFrameLoop((deltaMs) => {
      const target = levelRef.current;
      const blend = smoothStep(deltaMs, 28);
      displayLevelRef.current +=
        (target - displayLevelRef.current) * blend;

      streamRef.current.pushWave(displayLevelRef.current);
      setWaveFrame((tick) => tick + 1);

      specAccumulator += deltaMs;
      if (specAccumulator >= SPEC_COLUMN_MS) {
        specAccumulator = 0;
        const sample = streamRef.current.pushSpectrogramColumn();
        setSampleHz((current) =>
          Math.abs(current - sample.hz) >= 1 ? sample.hz : current,
        );
        setSpecFrame((tick) => tick + 1);
      }

      elapsedAccumulator += deltaMs;
      if (elapsedAccumulator >= 250 && startedAtRef.current != null) {
        elapsedAccumulator = 0;
        setElapsedSec((Date.now() - startedAtRef.current) / 1000);
      }
    });

    return cancel;
  }, [visible, active, levelRef]);

  const columns = streamRef.current.getColumns();
  const waveSamples = streamRef.current.getWaveLevels().slice(-WAVE_BARS);
  void waveFrame;
  void specFrame;

  const wavePoints = useMemo(() => {
    const samples = streamRef.current.getWaveLevels().slice(-WAVE_BARS);
    if (samples.length < 2 || plotWidth <= 0) return "";
    const midY = STRIP_HEIGHT / 2;
    const step = plotWidth / Math.max(samples.length - 1, 1);
    return samples
      .map((amp, index) => {
        const x = index * step;
        const y = midY - amp * (STRIP_HEIGHT * 0.42);
        return `${x},${y}`;
      })
      .join(" ");
  }, [plotWidth, waveFrame]);

  const hasCapture = columns.length > 0 || startedAtRef.current != null;

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

      <View style={styles.panel}>
        <View
          style={[styles.plotClip, { height: STRIP_HEIGHT }]}
          onLayout={(event) => handlePlotLayout(event.nativeEvent.layout.width)}
        >
          <SpectrogramStrip
            columns={columns}
            plotWidth={plotWidth}
            revision={specFrame}
          />
          <PlotAxisOverlay
            labels={[
              { text: "4k", top: FREQ_LABEL_TOP },
              { text: "2k", top: FREQ_LABEL_MID },
              { text: "0", top: FREQ_LABEL_BOTTOM },
            ]}
          />
        </View>

        <View style={[styles.divider]} />

        <View style={[styles.plotClip, { height: STRIP_HEIGHT }]}>
          <WaveformStrip
            waveSamples={waveSamples}
            wavePoints={wavePoints}
            plotWidth={plotWidth}
            revision={waveFrame}
          />
          <PlotAxisOverlay labels={[{ text: "lvl", top: FREQ_LABEL_MID }]} />
        </View>

        <Text style={styles.timeCaption}>Time →</Text>
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
    paddingHorizontal: PANEL_PAD_X,
  },
  panel: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(95, 148, 112, 0.28)",
    backgroundColor: "#121712",
    paddingVertical: PANEL_PAD_Y,
    paddingHorizontal: PANEL_PAD_X,
    overflow: "hidden",
    alignItems: "stretch",
    gap: 0,
  },
  plotClip: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 4,
    width: "100%",
  },
  axisOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  axisLabelText: {
    position: "absolute",
    left: AXIS_LABEL_INSET,
    fontSize: 8,
    lineHeight: AXIS_LABEL_HEIGHT,
    color: "rgba(168, 212, 180, 0.88)",
    fontFamily: "JetBrainsMono_400Regular",
    textAlign: "left",
    textShadowColor: "rgba(0, 0, 0, 0.85)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(138, 158, 130, 0.22)",
    marginVertical: 8,
    width: "100%",
  },
  timeCaption: {
    marginTop: 6,
    fontSize: 8,
    lineHeight: 10,
    color: "rgba(138, 158, 130, 0.65)",
    fontFamily: "JetBrainsMono_400Regular",
    textAlign: "right",
    width: "100%",
  },
});
