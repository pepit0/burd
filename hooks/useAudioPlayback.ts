import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import { loadAudioPeaks, seededFallbackPeaks, synthesizeLiveLevels } from "@/lib/audioPeaks";
import { getUserFacingMessage } from "@/lib/errors";
import { WebAudioPlaybackEngine } from "@/lib/webAudioPlayback";

export const PLAYBACK_BAR_COUNT = 24;

export interface AudioPlaybackState {
  peaks: number[];
  peaksLoading: boolean;
  loading: boolean;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  error: string | null;
  liveLevels: number[] | null;
  toggle: () => Promise<void>;
}

async function playNativeSound(sound: Audio.Sound): Promise<void> {
  const status = await sound.getStatusAsync();
  if (!status.isLoaded) {
    await sound.playAsync();
    return;
  }

  const duration = status.durationMillis ?? 0;
  const position = status.positionMillis ?? 0;
  const atEnd = duration > 0 && position >= duration - 80;

  if (atEnd || status.didJustFinish) {
    await sound.setPositionAsync(0);
  }

  await sound.playAsync();
}

export function useAudioPlayback(
  uri: string | null | undefined,
  durationMs?: number,
): AudioPlaybackState {
  const soundRef = useRef<Audio.Sound | null>(null);
  const webEngineRef = useRef<WebAudioPlaybackEngine | null>(null);
  const peaksRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const nativeAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef(false);

  const [peaks, setPeaks] = useState<number[]>([]);
  const [peaksLoading, setPeaksLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [loadedDurationMs, setLoadedDurationMs] = useState(durationMs ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [liveLevels, setLiveLevels] = useState<number[] | null>(null);

  const isWeb = Platform.OS === "web";

  peaksRef.current = peaks;
  loadingRef.current = loading;

  const stopNativeAnimationLoop = useCallback(() => {
    if (nativeAnimRef.current != null) {
      clearInterval(nativeAnimRef.current);
      nativeAnimRef.current = null;
    }
  }, []);

  const stopWebAnimationLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const resetPlaybackVisual = useCallback(() => {
    stopNativeAnimationLoop();
    stopWebAnimationLoop();
    setLiveLevels(null);
  }, [stopNativeAnimationLoop, stopWebAnimationLoop]);

  const startNativeAnimation = useCallback(() => {
    if (nativeAnimRef.current != null) {
      clearInterval(nativeAnimRef.current);
    }

    nativeAnimRef.current = setInterval(() => {
      const sound = soundRef.current;
      if (!sound) return;
      void sound.getStatusAsync().then((status) => {
        if (!status.isLoaded || !status.isPlaying) return;
        const pos = status.positionMillis ?? 0;
        const dur = status.durationMillis ?? loadedDurationMs;
        setPositionMs(pos);
        setLiveLevels(
          synthesizeLiveLevels(peaksRef.current, pos, dur, PLAYBACK_BAR_COUNT),
        );
      });
    }, 50);
  }, [loadedDurationMs]);

  const startWebAnimation = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    const tick = () => {
      const engine = webEngineRef.current;
      if (!engine) return;
      setPositionMs(engine.getPositionMs());
      setLiveLevels(engine.getLiveLevels(PLAYBACK_BAR_COUNT));
      if (engine.isPlaying()) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    setPlaying(false);
    setPositionMs(0);
    setLoadedDurationMs(durationMs ?? 0);
    setError(null);
    setLiveLevels(null);
    setPeaks([]);

    void soundRef.current?.unloadAsync().catch(() => undefined);
    soundRef.current = null;
    webEngineRef.current?.dispose();
    webEngineRef.current = null;
    resetPlaybackVisual();

    if (!uri) return undefined;

    let cancelled = false;
    setPeaksLoading(true);

    if (isWeb) {
      const engine = new WebAudioPlaybackEngine();
      webEngineRef.current = engine;
      engine.setOnEnded(() => {
        setPlaying(false);
        setPositionMs(0);
        resetPlaybackVisual();
      });

      void engine
        .load(uri, PLAYBACK_BAR_COUNT)
        .then(() => {
          if (cancelled) return;
          setPeaks(engine.peaks);
          setLoadedDurationMs(engine.getDurationMs() || durationMs || 0);
        })
        .catch((e) => {
          if (!cancelled) {
            setPeaks(seededFallbackPeaks(uri, PLAYBACK_BAR_COUNT));
            setError(getUserFacingMessage(e, "Couldn't play this audio."));
          }
        })
        .finally(() => {
          if (!cancelled) setPeaksLoading(false);
        });
    } else {
      void loadAudioPeaks(uri, PLAYBACK_BAR_COUNT)
        .then((loadedPeaks) => {
          if (!cancelled) setPeaks(loadedPeaks);
        })
        .catch(() => {
          if (!cancelled) setPeaks(seededFallbackPeaks(uri, PLAYBACK_BAR_COUNT));
        })
        .finally(() => {
          if (!cancelled) setPeaksLoading(false);
        });
    }

    return () => {
      cancelled = true;
      resetPlaybackVisual();
      void soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
      webEngineRef.current?.dispose();
      webEngineRef.current = null;
    };
  }, [uri, durationMs, isWeb, resetPlaybackVisual]);

  const toggle = useCallback(async () => {
    if (!uri || loadingRef.current) return;

    if (isWeb) {
      const engine = webEngineRef.current;
      if (!engine) return;

      setError(null);
      if (engine.isPlaying()) {
        const pos = engine.getPositionMs();
        setLiveLevels(engine.getLiveLevels(PLAYBACK_BAR_COUNT));
        setPositionMs(pos);
        engine.pause();
        stopWebAnimationLoop();
        setPlaying(false);
        return;
      }

      setLoading(true);
      try {
        await engine.play();
        setPlaying(true);
        setLoadedDurationMs(engine.getDurationMs() || loadedDurationMs);
        startWebAnimation();
      } catch (e) {
        setError(getUserFacingMessage(e, "Couldn't play this audio."));
        setPlaying(false);
        resetPlaybackVisual();
      } finally {
        setLoading(false);
      }
      return;
    }

    if (playing && soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          const pos = status.positionMillis ?? 0;
          const dur = status.durationMillis ?? loadedDurationMs;
          setPositionMs(pos);
          setLiveLevels(
            synthesizeLiveLevels(peaksRef.current, pos, dur, PLAYBACK_BAR_COUNT),
          );
        }
        await soundRef.current.pauseAsync();
        stopNativeAnimationLoop();
        setPlaying(false);
      } catch (e) {
        setError(getUserFacingMessage(e, "Couldn't play this audio."));
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, progressUpdateIntervalMillis: 50 },
          (status) => {
            if (!status.isLoaded) {
              if ("error" in status && status.error) {
                setError(status.error);
                setPlaying(false);
                resetPlaybackVisual();
              }
              return;
            }
            const pos = status.positionMillis ?? 0;
            const dur = status.durationMillis ?? loadedDurationMs;
            setPositionMs(pos);
            if (status.durationMillis) {
              setLoadedDurationMs(status.durationMillis);
            }
            const isPlayingNow = status.isPlaying ?? false;
            setPlaying(isPlayingNow);
            if (isPlayingNow) {
              setLiveLevels(
                synthesizeLiveLevels(peaksRef.current, pos, dur, PLAYBACK_BAR_COUNT),
              );
            }
            if (status.didJustFinish) {
              setPlaying(false);
              setPositionMs(0);
              resetPlaybackVisual();
            }
          },
        );
        soundRef.current = sound;
        setPlaying(true);
        startNativeAnimation();
        return;
      }

      await playNativeSound(soundRef.current);
      setPlaying(true);
      startNativeAnimation();
    } catch (e) {
      setError(getUserFacingMessage(e, "Couldn't play this audio."));
      setPlaying(false);
      resetPlaybackVisual();
      void soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [
    uri,
    isWeb,
    playing,
    loadedDurationMs,
    startWebAnimation,
    stopWebAnimationLoop,
    startNativeAnimation,
    stopNativeAnimationLoop,
    resetPlaybackVisual,
  ]);

  const totalMs = loadedDurationMs || durationMs || 0;

  return {
    peaks,
    peaksLoading,
    loading,
    playing,
    positionMs,
    durationMs: totalMs,
    error,
    liveLevels,
    toggle,
  };
}
