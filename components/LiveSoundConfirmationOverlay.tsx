import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Text, View } from "react-native";
import { Check, Mic, X } from "lucide-react-native";
import {
  displayScientificName,
  displaySpeciesName,
} from "@/lib/predictionLabels";
import { speciesKeysMatch } from "@/lib/speciesMatch";
import type { LivePhotoDetection } from "@/lib/livePhotoSession";
import type { LiveDetection } from "@/lib/liveSoundSession";

interface LiveSoundConfirmationOverlayProps {
  enabled: boolean;
  isProcessing: boolean;
  soundDetection: LiveDetection | null;
  photoDetection: LivePhotoDetection | null;
  bannerTop: number;
}

export function LiveSoundConfirmationOverlay({
  enabled,
  isProcessing,
  soundDetection,
  photoDetection,
  bannerTop,
}: LiveSoundConfirmationOverlayProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const agrees = speciesKeysMatch(photoDetection, soundDetection);
  const hasPhotoReference = Boolean(photoDetection);
  const showBanner = Boolean(
    enabled && (soundDetection || (isProcessing && !soundDetection)),
  );

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: showBanner ? 1 : 0,
        useNativeDriver: true,
        tension: 68,
        friction: 11,
      }),
      Animated.timing(opacityAnim, {
        toValue: showBanner ? 1 : 0,
        duration: showBanner ? 280 : 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnim, showBanner, slideAnim]);

  if (!enabled) return null;

  const soundName = soundDetection
    ? displaySpeciesName(soundDetection.prediction)
    : "";
  const photoName = photoDetection
    ? displaySpeciesName(photoDetection.prediction)
    : "";

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute inset-x-4 z-10"
      style={{
        top: bannerTop,
        opacity: opacityAnim,
        transform: [
          {
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-16, 0],
            }),
          },
        ],
      }}
    >
      {!soundDetection && isProcessing ? (
        <View className="items-center">
          <View className="flex-row items-center gap-2 rounded-full bg-background/70 px-3 py-1.5">
            <ActivityIndicator size="small" color="#5f9470" />
            <Text className="font-sans text-xs text-foreground/80">Listening…</Text>
          </View>
        </View>
      ) : null}

      {soundDetection ? (
        <View
          className={`overflow-hidden rounded-2xl border shadow-lg ${
            hasPhotoReference && agrees
              ? "border-primary/40 bg-black/60"
              : hasPhotoReference
                ? "border-amber-400/35 bg-black/60"
                : "border-white/20 bg-black/55"
          }`}
        >
          <View className="flex-row items-center gap-3 px-3.5 py-3">
            <View
              className={`h-10 w-10 items-center justify-center rounded-full ${
                hasPhotoReference && agrees
                  ? "bg-primary/25"
                  : hasPhotoReference
                    ? "bg-amber-400/15"
                    : "bg-white/10"
              }`}
            >
              {hasPhotoReference && agrees ? (
                <Check size={18} color="#5f9470" />
              ) : hasPhotoReference ? (
                <X size={16} color="#fbbf24" />
              ) : (
                <Mic size={16} color="#8a9e82" />
              )}
            </View>

            <View className="min-w-0 flex-1">
              {hasPhotoReference && agrees ? (
                <>
                  <Text className="font-sans-medium text-[10px] uppercase tracking-wide text-primary">
                    Photo & sound agree
                  </Text>
                  <Text
                    className="font-serif-semibold text-base text-foreground"
                    numberOfLines={1}
                  >
                    {soundName}
                  </Text>
                </>
              ) : hasPhotoReference ? (
                <>
                  <Text className="font-sans-medium text-[10px] uppercase tracking-wide text-amber-300/90">
                    Sound differs from photo
                  </Text>
                  <Text className="font-sans text-xs text-foreground/85" numberOfLines={2}>
                    Photo: {photoName} · Sound: {soundName}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="font-sans-medium text-[10px] uppercase tracking-wide text-muted-foreground">
                    Hearing
                  </Text>
                  <Text
                    className="font-serif-semibold text-base text-foreground"
                    numberOfLines={1}
                  >
                    {soundName}
                  </Text>
                  {displayScientificName(soundDetection.prediction) ? (
                    <Text
                      className="font-serif-italic text-xs text-muted-foreground"
                      numberOfLines={1}
                    >
                      {displayScientificName(soundDetection.prediction)}
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            <View className="items-end">
              <Text className="font-mono text-sm text-foreground/90">
                {Math.round(soundDetection.peakConfidence * 100)}%
              </Text>
              <Text className="font-sans text-[10px] text-muted-foreground">sound</Text>
            </View>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}
