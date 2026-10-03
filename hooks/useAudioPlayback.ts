import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import { loadAudioPeaks, seededFallbackPeaks, synthesizeLiveLevels } from "@/lib/audioPeaks";
import { getUserFacingMessage } from "@/lib/errors";
import { WebAudioPlaybackEngine } from "@/lib/webAudioPlayback";

export const PLAYBACK_BAR_COUNT = 24;

export interface AudioPlaybackOptions {
  trimStartMs?: number;
  trimEndMs?: number;
  /** Skip decode/peak work until play — keeps feed scrolling smooth. */
  deferLoad?: boolean;
}

export interface AudioPlaybackState {
  peaks: number[];
  peaksLoading: boolean;
  loading: boolean;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  /** Full source length, even when playback is trimmed. */
  sourceDurationMs: number;
  error: string | null;
  liveLevels: number[] | null;
  toggle: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
}

interface TrimBounds {
  start: number;
  end: number;
  trimmedDuration: number;
  total: number;
  active: boolean;
}

function resolveTrimBounds(
  loadedDurationMs: number,
  durationMs: number | undefined,
  options?: AudioPlaybackOptions,
): TrimBounds {
  const total = loadedDurationMs || durationMs || 0;
  const start = Math.max(0, options?.trimStartMs ?? 0);
  const end =
    options?.trimEndMs != null && options.trimEndMs > start
      ? Math.min(options.trimEndMs, total || options.trimEndMs)
      : total;
  const trimmedDuration = Math.max(0, end - start);
  const active =
    options?.trimStartMs != null &&
    options?.trimEndMs != null &&
    trimmedDuration > 0 &&
    (start > 0 || (total > 0 && end < total - 80));
  return { start, end, trimmedDuration, total, active };
}

function toRelativePosition(absoluteMs: number, start: number, end: number): number {
  return Math.max(0, Math.min(absoluteMs - start, end - start));
}

function toAbsolutePosition(relativeMs: number, start: number, end: number): number {
  return Math.max(start, Math.min(start + relativeMs, end));
}

function waitForPlayerLoad(
  player: AudioPlayer,
  timeoutMs = 15000,
): Promise<void> {
  if (player.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    let subscription: { remove: () => void } | undefined;
    const timer = setTimeout(() => {
      subscription?.remove();
      resolve();
    }, timeoutMs);
    subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.isLoaded || status.error) {
        clearTimeout(timer);
        subscription?.remove();
        resolve();
      }
    });
  });
}

async function probeNativeDuration(uri: string): Promise<number> {
  try {
    const player = createAudioPlayer(uri, { updateInterval: 100 });
    try {
      await waitForPlayerLoad(player);
      if (player.isLoaded && player.duration > 0) {
        return player.duration * 1000;
      }
    } finally {
      player.remove();
    }
  } catch {
    // fall through
  }
  return 0;
}

export function useAudioPlayback(
  uri: string | null | undefined,
  durationMs?: number,
  options?: AudioPlaybackOptions,
): AudioPlaybackState {
  const soundRef = useRef<AudioPlayer | null>(null);
  const soundListenerSubRef = useRef<
    ReturnType<AudioPlayer["addListener"]> | null
  >(null);
  const webEngineRef = useRef<WebAudioPlaybackEngine | null>(null);
  const peaksRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const nativeAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef(false);
  const playingRef = useRef(false);
  const mediaPreparedRef = useRef(false);
  const optionsRef = useRef(options);
  const loadedDurationRef = useRef(durationMs ?? 0);

  optionsRef.current = options;

  const disposePlayer = useCallback(() => {
    soundListenerSubRef.current?.remove();
    soundListenerSubRef.current = null;
    soundRef.current?.remove();
    soundRef.current = null;
  }, []);

  const [peaks, setPeaks] = useState<number[]>([]);
  const [peaksLoading, setPeaksLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [loadedDurationMs, setLoadedDurationMs] = useState(durationMs ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [liveLevels, setLiveLevels] = useState<number[] | null>(null);

  const isWeb = Platform.OS === "web";
  loadedDurationRef.current = loadedDurationMs;

  peaksRef.current = peaks;
  loadingRef.current = loading;
  playingRef.current = playing;

  const getTrimBounds = useCallback((): TrimBounds => {
    return resolveTrimBounds(
      loadedDurationRef.current,
      durationMs,
      optionsRef.current,
    );
  }, [durationMs]);

  const syncVisualPosition = useCallback(
    (absoluteMs: number, dur?: number) => {
      const trim = getTrimBounds();
      const total = dur ?? trim.total;
      const clamped = trim.active
        ? Math.max(trim.start, Math.min(absoluteMs, trim.end))
        : absoluteMs;
      const visualPos = trim.active
        ? toRelativePosition(clamped, trim.start, trim.end)
        : clamped;
      setPositionMs(visualPos);
      if (peaksRef.current.length > 0) {
        setLiveLevels(
          synthesizeLiveLevels(
            peaksRef.current,
            trim.active ? clamped : visualPos,
            total,
            PLAYBACK_BAR_COUNT,
          ),
        );
      }
    },
    [getTrimBounds],
  );

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

  const stopAtTrimEnd = useCallback(
    async (absoluteMs: number) => {
      const trim = getTrimBounds();
      if (!trim.active || absoluteMs < trim.end - 80) return false;

      if (isWeb) {
        webEngineRef.current?.pause();
        webEngineRef.current?.seekTo(trim.start);
      } else if (soundRef.current) {
        soundRef.current.pause();
        await soundRef.current.seekTo(trim.start / 1000).catch(() => undefined);
      }

      setPlaying(false);
      syncVisualPosition(trim.start);
      resetPlaybackVisual();
      return true;
    },
    [getTrimBounds, isWeb, resetPlaybackVisual, syncVisualPosition],
  );

  const ensureTrimStart = useCallback(async () => {
    const trim = getTrimBounds();
    if (!trim.active) return;

    if (isWeb) {
      const engine = webEngineRef.current;
      if (!engine) return;
      const pos = engine.getPositionMs();
      if (pos < trim.start || pos >= trim.end - 40) {
        engine.seekTo(trim.start);
        syncVisualPosition(trim.start, engine.getDurationMs());
      }
      return;
    }

    const sound = soundRef.current;
    if (!sound || !sound.isLoaded) return;
    const pos = sound.currentTime * 1000;
    if (pos < trim.start || pos >= trim.end - 40) {
      await sound.seekTo(trim.start / 1000);
      syncVisualPosition(trim.start, sound.duration * 1000 || loadedDurationRef.current);
    }
  }, [getTrimBounds, isWeb, syncVisualPosition]);

  const startNativeAnimation = useCallback(() => {
    if (nativeAnimRef.current != null) {
      clearInterval(nativeAnimRef.current);
    }

    nativeAnimRef.current = setInterval(() => {
      const sound = soundRef.current;
      if (!sound || !sound.isLoaded || !sound.playing) return;
      const pos = sound.currentTime * 1000;
      const dur = sound.duration * 1000 || loadedDurationRef.current;
      void stopAtTrimEnd(pos).then((stopped) => {
        if (!stopped) syncVisualPosition(pos, dur);
      });
    }, 50);
  }, [stopAtTrimEnd, syncVisualPosition]);

  const startWebAnimation = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    const tick = async () => {
      const engine = webEngineRef.current;
      if (!engine) return;
      const pos = engine.getPositionMs();
      if (await stopAtTrimEnd(pos)) return;
      syncVisualPosition(pos, engine.getDurationMs());
      setLiveLevels(engine.getLiveLevels(PLAYBACK_BAR_COUNT));
      if (engine.isPlaying()) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopAtTrimEnd, syncVisualPosition]);

  const attachWebEngineEnded = useCallback(
    (engine: WebAudioPlaybackEngine) => {
      engine.setOnEnded(() => {
        const trim = resolveTrimBounds(
          loadedDurationRef.current,
          durationMs,
          optionsRef.current,
        );
        setPlaying(false);
        if (trim.active) {
          engine.seekTo(trim.start);
          syncVisualPosition(trim.start, engine.getDurationMs());
        } else {
          syncVisualPosition(0, engine.getDurationMs());
        }
        resetPlaybackVisual();
      });
    },
    [durationMs, resetPlaybackVisual, syncVisualPosition],
  );

  const loadMediaAssets = useCallback(async (): Promise<boolean> => {
    if (!uri) return false;
    if (mediaPreparedRef.current) return true;

    setPeaksLoading(true);
    try {
      if (isWeb) {
        let engine = webEngineRef.current;
        if (!engine) {
          engine = new WebAudioPlaybackEngine();
          webEngineRef.current = engine;
          attachWebEngineEnded(engine);
        }
        await engine.load(uri, PLAYBACK_BAR_COUNT);
        setPeaks(engine.peaks);
        const total = engine.getDurationMs() || durationMs || 0;
        setLoadedDurationMs(total);
        loadedDurationRef.current = total;
      } else {
        const [loadedPeaks, probedDuration] = await Promise.all([
          loadAudioPeaks(uri, PLAYBACK_BAR_COUNT),
          probeNativeDuration(uri),
        ]);
        setPeaks(loadedPeaks);
        if (probedDuration > 0) {
          setLoadedDurationMs(probedDuration);
          loadedDurationRef.current = probedDuration;
        }
      }
      mediaPreparedRef.current = true;
      return true;
    } catch (e) {
      setPeaks(seededFallbackPeaks(uri, PLAYBACK_BAR_COUNT));
      if (isWeb) {
        setError(getUserFacingMessage(e, "Couldn't play this audio."));
      }
      return false;
    } finally {
      setPeaksLoading(false);
    }
  }, [attachWebEngineEnded, durationMs, isWeb, uri]);

  useEffect(() => {
    mediaPreparedRef.current = false;
    setPlaying(false);
    setPositionMs(0);
    setLoadedDurationMs(durationMs ?? 0);
    loadedDurationRef.current = durationMs ?? 0;
    setError(null);
    setLiveLevels(null);
    setPeaks([]);

    disposePlayer();
    webEngineRef.current?.dispose();
    webEngineRef.current = null;
    resetPlaybackVisual();

    if (!uri) return undefined;

    if (optionsRef.current?.deferLoad) {
      setPeaks(seededFallbackPeaks(uri, PLAYBACK_BAR_COUNT));
      setPeaksLoading(false);
      return () => {
        resetPlaybackVisual();
        disposePlayer();
        webEngineRef.current?.dispose();
        webEngineRef.current = null;
        mediaPreparedRef.current = false;
      };
    }

    let cancelled = false;
    void loadMediaAssets().finally(() => {
      if (cancelled) {
        mediaPreparedRef.current = false;
      }
    });

    return () => {
      cancelled = true;
      mediaPreparedRef.current = false;
      resetPlaybackVisual();
      disposePlayer();
      webEngineRef.current?.dispose();
      webEngineRef.current = null;
    };
  }, [uri, durationMs, disposePlayer, loadMediaAssets, resetPlaybackVisual]);

  useEffect(() => {
    const trim = getTrimBounds();
    if (!trim.active) return;
    syncVisualPosition(trim.start);
    if (playingRef.current) {
      void ensureTrimStart();
    }
  }, [
    options?.trimStartMs,
    options?.trimEndMs,
    getTrimBounds,
    syncVisualPosition,
    ensureTrimStart,
  ]);

  const toggle = useCallback(async () => {
    if (!uri || loadingRef.current) return;

    if (optionsRef.current?.deferLoad && !mediaPreparedRef.current) {
      setLoading(true);
      const ready = await loadMediaAssets();
      setLoading(false);
      if (!ready) return;
    }

    if (isWeb) {
      const engine = webEngineRef.current;
      if (!engine) return;

      setError(null);
      if (engine.isPlaying()) {
        syncVisualPosition(engine.getPositionMs(), engine.getDurationMs());
        engine.pause();
        stopWebAnimationLoop();
        setPlaying(false);
        return;
      }

      setLoading(true);
      try {
        await ensureTrimStart();
        await engine.play();
        setPlaying(true);
        const total = engine.getDurationMs() || loadedDurationRef.current;
        setLoadedDurationMs(total);
        loadedDurationRef.current = total;
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
        const sound = soundRef.current;
        if (sound.isLoaded) {
          syncVisualPosition(
            sound.currentTime * 1000,
            sound.duration * 1000 || loadedDurationRef.current,
          );
        }
        sound.pause();
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
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "duckOthers",
        shouldRouteThroughEarpiece: false,
      });

      const trim = getTrimBounds();

      if (!soundRef.current) {
        const sound = createAudioPlayer(uri, { updateInterval: 50 });
        soundListenerSubRef.current?.remove();
        soundListenerSubRef.current = sound.addListener(
          "playbackStatusUpdate",
          (status) => {
            if (!status.isLoaded) {
              if (status.error) {
                setError(status.error);
                setPlaying(false);
                resetPlaybackVisual();
              }
              return;
            }
            const pos = status.currentTime * 1000;
            const dur = status.duration * 1000 || loadedDurationRef.current;
            if (status.duration > 0) {
              setLoadedDurationMs(status.duration * 1000);
              loadedDurationRef.current = status.duration * 1000;
            }
            const isPlayingNow = status.playing;
            setPlaying(isPlayingNow);
            if (isPlayingNow) {
              void stopAtTrimEnd(pos).then((stopped) => {
                if (!stopped) syncVisualPosition(pos, dur);
              });
            } else {
              syncVisualPosition(pos, dur);
            }
            if (status.didJustFinish) {
              const currentTrim = resolveTrimBounds(
                loadedDurationRef.current,
                durationMs,
                optionsRef.current,
              );
              const resetPos = currentTrim.active ? currentTrim.start : 0;
              void sound.seekTo(resetPos / 1000).catch(() => undefined);
              syncVisualPosition(resetPos, dur);
              setPlaying(false);
              resetPlaybackVisual();
            }
          },
        );
        soundRef.current = sound;
        // expo-audio loads asynchronously; wait before trim positioning.
        await waitForPlayerLoad(sound);
        await ensureTrimStart();
        sound.play();
        setPlaying(true);
        startNativeAnimation();
        return;
      }

      await ensureTrimStart();
      const sound = soundRef.current;
      if (!sound) return;
      if (sound.isLoaded) {
        const pos = sound.currentTime * 1000;
        const dur = sound.duration * 1000;
        const atTrimEnd = trim.active && pos >= trim.end - 80;
        const atNaturalEnd = dur > 0 && pos >= dur - 100;
        if (atTrimEnd || atNaturalEnd) {
          await sound.seekTo(trim.start / 1000);
          syncVisualPosition(trim.start, dur);
        }
      }
      sound.play();
      setPlaying(true);
      startNativeAnimation();
    } catch (e) {
      setError(getUserFacingMessage(e, "Couldn't play this audio."));
      setPlaying(false);
      resetPlaybackVisual();
    } finally {
      setLoading(false);
    }
  }, [
    uri,
    isWeb,
    playing,
    durationMs,
    loadMediaAssets,
    startWebAnimation,
    stopWebAnimationLoop,
    startNativeAnimation,
    stopNativeAnimationLoop,
    resetPlaybackVisual,
    ensureTrimStart,
    stopAtTrimEnd,
    syncVisualPosition,
    getTrimBounds,
  ]);

  const seekTo = useCallback(
    async (relativeOrAbsoluteMs: number) => {
      if (!uri) return;

      const trim = getTrimBounds();
      const totalMs = trim.total;
      const absoluteMs = trim.active
        ? toAbsolutePosition(relativeOrAbsoluteMs, trim.start, trim.end)
        : totalMs > 0
          ? Math.max(0, Math.min(relativeOrAbsoluteMs, totalMs))
          : Math.max(0, relativeOrAbsoluteMs);

      syncVisualPosition(absoluteMs, totalMs);

      if (isWeb) {
        const engine = webEngineRef.current;
        engine?.seekTo(absoluteMs);
        if (playingRef.current) {
          startWebAnimation();
        }
        return;
      }

      const sound = soundRef.current;
      if (!sound) return;

      try {
        const wasPlaying =
          playingRef.current || (sound.isLoaded && sound.playing);

        await sound.seekTo(absoluteMs / 1000);

        if (wasPlaying) {
          sound.play();
          setPlaying(true);
          startNativeAnimation();
        }
      } catch (e) {
        setError(getUserFacingMessage(e, "Couldn't play this audio."));
      }
    },
    [uri, isWeb, getTrimBounds, startNativeAnimation, startWebAnimation, syncVisualPosition],
  );

  const trim = getTrimBounds();
  const displayDurationMs = trim.active ? trim.trimmedDuration : trim.total;

  return {
    peaks,
    peaksLoading,
    loading,
    playing,
    positionMs,
    durationMs: displayDurationMs,
    sourceDurationMs: trim.total,
    error,
    liveLevels,
    toggle,
    seekTo,
  };
}
