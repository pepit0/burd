import { PlaybackWaveform } from "@/components/PlaybackWaveform";
import { useAudioPlayback, type AudioPlaybackState } from "@/hooks/useAudioPlayback";

interface SightingAudioSectionProps {
  uri: string;
  durationMs?: number;
  variant?: "hero" | "inline";
  waveformClassName?: string;
  playback?: AudioPlaybackState;
}

export function SightingAudioSection({
  uri,
  durationMs,
  variant = "hero",
  waveformClassName = "",
  playback: externalPlayback,
}: SightingAudioSectionProps) {
  const internalPlayback = useAudioPlayback(externalPlayback ? null : uri, durationMs);
  const playback = externalPlayback ?? internalPlayback;

  return (
    <PlaybackWaveform
      playback={playback}
      className={waveformClassName}
      variant={variant}
      interactive
    />
  );
}

export { useAudioPlayback };
