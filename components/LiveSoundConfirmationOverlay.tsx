import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Text, View } from "react-native";
import { Check, Mic, X } from "lucide-react-native";
import { SpeciesImage } from "@/components/SpeciesImage";
import { catalogIdFromScientific } from "@/lib/photoCatalog";
import {
  displayScientificName,
  displaySpeciesName,
} from "@/lib/predictionLabels";
import { speciesKeysMatch } from "@/lib/speciesMatch";
import { CameraOriented } from "@/components/CameraOriented";
import type { CameraUiRotation } from "@/hooks/useCameraDeviceOrientation";
import type { LiveSoundDisplayRow } from "@/hooks/useLiveSoundConfirmation";
import type { LivePhotoDetection } from "@/lib/livePhotoSession";
import type { LiveDetection } from "@/lib/liveSoundSession";

interface LiveSoundConfirmationOverlayProps {
  enabled: boolean;
  isProcessing: boolean;
  chunkWarning?: string | null;
  soundDetection: LiveDetection | null;
  displayRows?: LiveSoundDisplayRow[];
  photoDetection: LivePhotoDetection | null;
  bannerTop: number;
  uiRotation?: CameraUiRotation;
}

const MAX_VISIBLE_ROWS = 3;

function speciesImageMeta(detection: LiveDetection) {
  const commonName = displaySpeciesName(detection.prediction);
  const scientificName = displayScientificName(detection.prediction);
  const scientificForImage =
    detection.prediction.scientific_name ?? scientificName ?? commonName;
  const catalogId =
    detection.catalogId ?? catalogIdFromScientific(scientificForImage);
  return { commonName, scientificName, scientificForImage, catalogId };
}

function SoundDetectionBanner({
  detection,
  photoDetection,
  highlighted = false,
}: {
  detection: LiveDetection;
  photoDetection: LivePhotoDetection | null;
  highlighted?: boolean;
}) {
  const agrees = speciesKeysMatch(photoDetection, detection);
  const hasPhotoReference = Boolean(photoDetection);
  const { commonName, scientificName, scientificForImage, catalogId } =
    speciesImageMeta(detection);
  const photoName = photoDetection
    ? displaySpeciesName(photoDetection.prediction)
    : "";

  return (
    <View
      className={`overflow-hidden rounded-2xl border shadow-lg ${
        hasPhotoReference && agrees
          ? "border-primary/40 bg-black/60"
          : hasPhotoReference
            ? "border-amber-400/35 bg-black/60"
            : highlighted
              ? "border-accent/45 bg-black/60"
              : "border-white/20 bg-black/55"
      }`}
    >
      <View className="flex-row items-center gap-3 px-3.5 py-3">
        <View className="relative">
          <SpeciesImage
            catalogId={catalogId}
            scientificName={scientificForImage}
            className="h-12 w-12 rounded-xl"
            size="medium"
          />
          {hasPhotoReference ? (
            <View
              className={`absolute -bottom-1 -right-1 h-5 w-5 items-center justify-center rounded-full border border-black/40 ${
                agrees ? "bg-primary" : "bg-amber-400"
              }`}
            >
              {agrees ? (
                <Check size={11} color="#faf8f2" />
              ) : (
                <X size={10} color="#1a1810" />
              )}
            </View>
          ) : highlighted ? (
            <View className="absolute -bottom-1 -right-1 rounded-full border border-black/40 bg-accent px-1.5 py-0.5">
              <Mic size={9} color="#1a1810" />
            </View>
          ) : null}
        </View>

        <View className="min-w-0 flex-1 shrink">
          {hasPhotoReference && agrees ? (
            <>
              <Text className="font-sans-medium text-[10px] uppercase tracking-wide text-primary">
                Photo & sound agree
              </Text>
              <Text
                className="font-serif-semibold text-base text-foreground"
                numberOfLines={1}
              >
                {commonName}
              </Text>
            </>
          ) : hasPhotoReference ? (
            <>
              <Text className="font-sans-medium text-[10px] uppercase tracking-wide text-amber-300/90">
                Sound differs from photo
              </Text>
              <Text
                className="font-serif-semibold text-base text-foreground"
                numberOfLines={1}
              >
                {commonName}
              </Text>
              <Text className="font-sans text-xs text-foreground/75" numberOfLines={1}>
                Photo: {photoName}
              </Text>
            </>
          ) : (
            <>
              <View className="flex-row items-center gap-1.5">
                <Mic size={11} color="#8a9e82" />
                <Text className="font-sans-medium text-[10px] uppercase tracking-wide text-muted-foreground">
                  {highlighted ? "Hearing now" : "Heard"}
                </Text>
              </View>
              <Text
                className="font-serif-semibold text-base text-foreground"
                numberOfLines={1}
              >
                {commonName}
              </Text>
              {scientificName ? (
                <Text
                  className="font-serif-italic text-xs text-muted-foreground"
                  numberOfLines={1}
                >
                  {scientificName}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View className="shrink-0 items-end">
          <Text className="font-mono text-sm text-foreground/90">
            {Math.round(detection.peakConfidence * 100)}%
          </Text>
          <Text className="font-sans text-[10px] text-muted-foreground">sound</Text>
        </View>
      </View>
    </View>
  );
}

export function LiveSoundConfirmationOverlay({
  enabled,
  isProcessing,
  chunkWarning,
  soundDetection,
  displayRows = [],
  photoDetection,
  bannerTop,
  uiRotation = 0,
}: LiveSoundConfirmationOverlayProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const activeRows = displayRows.filter((row) => !row.isExpiring).slice(0, MAX_VISIBLE_ROWS);
  const showBanner = Boolean(
    enabled &&
      (activeRows.length > 0 ||
        chunkWarning ||
        (isProcessing && activeRows.length === 0)),
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

  const primaryRow =
    activeRows.find((row) => row.isHeardNow) ??
    activeRows.find((row) => row.detection.key === soundDetection?.key) ??
    activeRows[0] ??
    (soundDetection
      ? { detection: soundDetection, isExpiring: false, isHeardNow: true }
      : null);
  const secondaryRows = primaryRow
    ? activeRows.filter((row) => row.detection.key !== primaryRow.detection.key)
    : [];

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
      {activeRows.length === 0 && isProcessing && !chunkWarning ? (
        <View className="items-center">
          <CameraOriented rotation={uiRotation} align="center">
            <View className="flex-row items-center gap-2 rounded-full bg-background/70 px-3 py-1.5">
              <ActivityIndicator size="small" color="#5f9470" />
              <Text className="font-sans text-xs text-foreground/80">Listening…</Text>
            </View>
          </CameraOriented>
        </View>
      ) : null}

      {chunkWarning ? (
        <View className="items-center">
          <CameraOriented rotation={uiRotation} align="center">
            <View className="rounded-2xl border border-amber-400/35 bg-black/70 px-3.5 py-2.5">
              <Text className="font-sans text-xs leading-relaxed text-amber-100/90">
                {chunkWarning}
              </Text>
            </View>
          </CameraOriented>
        </View>
      ) : null}

      {primaryRow ? (
        <View className="w-full gap-2">
          <SoundDetectionBanner
            detection={primaryRow.detection}
            photoDetection={photoDetection}
            highlighted={primaryRow.isHeardNow}
          />
          {secondaryRows.map((row) => (
            <SoundDetectionBanner
              key={row.detection.key}
              detection={row.detection}
              photoDetection={null}
              highlighted={row.isHeardNow}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}
