import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Audio } from "expo-av";
import { Pause, Play } from "lucide-react-native";
import { getErrorMessage } from "@/lib/errors";

interface AudioPlayerProps {
  uri: string;
  durationMs?: number;
  compact?: boolean;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function AudioPlayer({ uri, durationMs, compact = false }: AudioPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [loadedDurationMs, setLoadedDurationMs] = useState(durationMs ?? 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlaying(false);
    setPositionMs(0);
    setLoadedDurationMs(durationMs ?? 0);
    setError(null);

    void soundRef.current?.unloadAsync().catch(() => undefined);
    soundRef.current = null;

    return () => {
      void soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    };
  }, [uri, durationMs]);

  async function togglePlayback() {
    if (loading || !uri) return;

    if (playing && soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } catch (e) {
        setError(getErrorMessage(e));
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
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) {
              if ("error" in status && status.error) {
                setError(status.error);
                setPlaying(false);
              }
              return;
            }
            setPositionMs(status.positionMillis ?? 0);
            if (status.durationMillis) {
              setLoadedDurationMs(status.durationMillis);
            }
            setPlaying(status.isPlaying ?? false);
            if (status.didJustFinish) {
              setPlaying(false);
              setPositionMs(0);
            }
          },
        );
        soundRef.current = sound;
        setPlaying(true);
        return;
      }

      await soundRef.current.playAsync();
      setPlaying(true);
    } catch (e) {
      setError(getErrorMessage(e));
      setPlaying(false);
      void soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    } finally {
      setLoading(false);
    }
  }

  const totalMs = loadedDurationMs || durationMs || 0;
  const progress = totalMs > 0 ? Math.min(1, positionMs / totalMs) : 0;

  if (compact) {
    return (
      <View className="gap-1">
        <Pressable
          onPress={() => void togglePlayback()}
          className="flex-row items-center gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-1.5 active:opacity-80"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#5f9470" />
          ) : playing ? (
            <Pause size={14} color="#5f9470" />
          ) : (
            <Play size={14} color="#5f9470" />
          )}
          <Text className="font-mono text-[10px] text-muted-foreground">
            {formatDuration(totalMs || positionMs)}
          </Text>
        </Pressable>
        {error ? (
          <Text className="font-sans text-[10px] text-red-400/90">{error}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="rounded-xl border border-border bg-card px-3 py-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => void togglePlayback()}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary/20 active:opacity-80"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#5f9470" />
          ) : playing ? (
            <Pause size={18} color="#5f9470" />
          ) : (
            <Play size={18} color="#5f9470" />
          )}
        </Pressable>
        <View className="min-w-0 flex-1 gap-1">
          <View className="h-1.5 overflow-hidden rounded-full bg-muted">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
          <Text className="font-mono text-[10px] text-muted-foreground">
            {formatDuration(positionMs)} / {formatDuration(totalMs)}
          </Text>
          {error ? (
            <Text className="font-sans text-[10px] text-red-400/90">{error}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
