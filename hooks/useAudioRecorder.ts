import { useCallback, useEffect, useRef, useState } from "react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder as useNativeAudioRecorder,
} from "expo-audio";

export const MAX_AUDIO_CAPTURE_SECONDS = 30;

interface AudioClip {
  uri: string;
  durationMs: number;
}

interface UseAudioRecorderResult {
  isRecording: boolean;
  seconds: number;
  clip: AudioClip | null;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<AudioClip | null>;
  reset: () => void;
}

const RECORDING_AUDIO_MODE = {
  allowsRecording: true,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  interruptionMode: "duckOthers",
  shouldRouteThroughEarpiece: false,
} as const;

export function useAudioRecorder(
  maxSeconds = MAX_AUDIO_CAPTURE_SECONDS,
): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<AudioClip | null>(null);

  const recorder = useNativeAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingActiveRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef<(() => Promise<AudioClip | null>) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<AudioClip | null> => {
    clearTimer();
    if (!recordingActiveRef.current) {
      setIsRecording(false);
      return clip;
    }

    try {
      // Duration must be read before stop(); expo-audio resets it on stop.
      const statusBefore = recorder.getStatus();
      await recorder.stop();
      recordingActiveRef.current = false;
      const uri = recorder.uri;
      setIsRecording(false);

      if (!uri) {
        setSeconds(0);
        return null;
      }

      const durationMs = statusBefore.durationMillis ?? 0;
      setSeconds(
        Math.min(maxSeconds, Math.max(1, Math.round(durationMs / 1000))),
      );
      const next: AudioClip = { uri, durationMs };
      setClip(next);
      return next;
    } catch {
      recordingActiveRef.current = false;
      setIsRecording(false);
      setSeconds(0);
      return null;
    }
  }, [clearTimer, clip, maxSeconds, recorder]);

  stopRef.current = stopRecording;

  const startRecording = useCallback(async (): Promise<boolean> => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return false;

    try {
      await setAudioModeAsync(RECORDING_AUDIO_MODE);

      if (recordingActiveRef.current) {
        await stopRecording();
      }

      setClip(null);
      setSeconds(0);

      // Passing options on every prepare gives each recording a fresh file.
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      recorder.record();
      recordingActiveRef.current = true;
      setIsRecording(true);

      clearTimer();
      timerRef.current = setInterval(() => {
        setSeconds((current) => {
          const next = current + 1;
          if (next >= maxSeconds) {
            void stopRef.current?.();
          }
          return Math.min(next, maxSeconds);
        });
      }, 1000);

      return true;
    } catch {
      recordingActiveRef.current = false;
      setIsRecording(false);
      setSeconds(0);
      return false;
    }
  }, [clearTimer, maxSeconds, recorder, stopRecording]);

  const reset = useCallback(() => {
    void stopRecording();
    setClip(null);
    setSeconds(0);
  }, [stopRecording]);

  useEffect(() => {
    void setAudioModeAsync(RECORDING_AUDIO_MODE);

    return () => {
      clearTimer();
      if (recordingActiveRef.current) {
        recordingActiveRef.current = false;
        void recorder.stop().catch(() => undefined);
      }
    };
  }, [clearTimer, recorder]);

  return {
    isRecording,
    seconds,
    clip,
    startRecording,
    stopRecording,
    reset,
  };
}
