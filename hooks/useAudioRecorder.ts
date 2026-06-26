import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";

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

export function useAudioRecorder(
  maxSeconds = MAX_AUDIO_CAPTURE_SECONDS,
): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<AudioClip | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
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
    const recording = recordingRef.current;
    if (!recording) {
      setIsRecording(false);
      return clip;
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();
      recordingRef.current = null;
      setIsRecording(false);

      if (!uri) {
        setSeconds(0);
        return null;
      }

      const durationMs = status.durationMillis ?? 0;
      setSeconds(
        Math.min(maxSeconds, Math.max(1, Math.round(durationMs / 1000))),
      );
      const next: AudioClip = { uri, durationMs };
      setClip(next);
      return next;
    } catch {
      recordingRef.current = null;
      setIsRecording(false);
      setSeconds(0);
      return null;
    }
  }, [clearTimer, clip, maxSeconds]);

  stopRef.current = stopRecording;

  const startRecording = useCallback(async (): Promise<boolean> => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return false;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      if (recordingRef.current) {
        await stopRecording();
      }

      setClip(null);
      setSeconds(0);

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
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
      recordingRef.current = null;
      setIsRecording(false);
      setSeconds(0);
      return false;
    }
  }, [clearTimer, maxSeconds, stopRecording]);

  const reset = useCallback(() => {
    void stopRecording();
    setClip(null);
    setSeconds(0);
  }, [stopRecording]);

  useEffect(() => {
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    return () => {
      clearTimer();
      void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
      recordingRef.current = null;
    };
  }, [clearTimer]);

  return {
    isRecording,
    seconds,
    clip,
    startRecording,
    stopRecording,
    reset,
  };
}
