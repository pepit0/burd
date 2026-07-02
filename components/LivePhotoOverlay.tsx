import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { SpeciesImage } from "@/components/SpeciesImage";
import { catalogIdFromScientific } from "@/lib/photoCatalog";
import {
  displayScientificName,
  displaySpeciesName,
} from "@/lib/predictionLabels";
import type { LivePhotoDetection } from "@/lib/livePhotoSession";

const RETICLE_GREEN = "#5f9470";
const RETICLE_GOLD = "#c8893a";

interface LivePhotoOverlayProps {
  enabled: boolean;
  isProcessing: boolean;
  primaryDetection: LivePhotoDetection | null;
  spottedInFrame: boolean;
  bannerTop: number;
  reticleTop: number;
  reticleBottom: number;
}

function ScanReticle({
  spotted,
  top,
  bottom,
}: {
  spotted: boolean;
  top: number;
  bottom: number;
}) {
  const colorAnim = useRef(new Animated.Value(spotted ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(colorAnim, {
      toValue: spotted ? 1 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [colorAnim, spotted]);

  const borderColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [RETICLE_GREEN, RETICLE_GOLD],
  });

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top, bottom, left: "6%", right: "6%" }}
    >
      <View className="h-full w-full">
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: 36,
            width: 36,
            borderTopWidth: 3,
            borderLeftWidth: 3,
            borderColor,
          }}
        />
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: 36,
            width: 36,
            borderTopWidth: 3,
            borderRightWidth: 3,
            borderColor,
          }}
        />
        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: 36,
            width: 36,
            borderBottomWidth: 3,
            borderLeftWidth: 3,
            borderColor,
          }}
        />
        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            height: 36,
            width: 36,
            borderBottomWidth: 3,
            borderRightWidth: 3,
            borderColor,
          }}
        />
      </View>
    </View>
  );
}

export function LivePhotoOverlay({
  enabled,
  isProcessing,
  primaryDetection,
  spottedInFrame,
  bannerTop,
  reticleTop,
  reticleBottom,
}: LivePhotoOverlayProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const visible = Boolean(enabled && primaryDetection);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: visible ? 1 : 0,
        useNativeDriver: true,
        tension: 68,
        friction: 11,
      }),
      Animated.timing(opacityAnim, {
        toValue: visible ? 1 : 0,
        duration: visible ? 280 : 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [enabled, opacityAnim, primaryDetection, slideAnim]);

  if (!enabled) return null;

  const commonName = primaryDetection
    ? displaySpeciesName(primaryDetection.prediction)
    : "";
  const scientificName = primaryDetection
    ? displayScientificName(primaryDetection.prediction)
    : null;
  const scientificForImage =
    primaryDetection?.prediction.scientific_name ??
    scientificName ??
    commonName;
  const imageCatalogId =
    primaryDetection?.catalogId ??
    catalogIdFromScientific(scientificForImage);

  return (
    <>
      <ScanReticle
        spotted={spottedInFrame}
        top={reticleTop}
        bottom={reticleBottom}
      />

      <View
        pointerEvents="none"
        className="absolute inset-x-4 z-10"
        style={{ top: bannerTop }}
      >
        {enabled && !primaryDetection && isProcessing ? (
          <View className="items-center">
            <View className="flex-row items-center gap-2 rounded-full bg-background/70 px-3 py-1.5">
              <ActivityIndicator size="small" color="#5f9470" />
              <Text className="font-sans text-xs text-foreground/80">Scanning…</Text>
            </View>
          </View>
        ) : null}

        <Animated.View
          style={{
            opacity: opacityAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          }}
        >
          {primaryDetection ? (
            <View className="overflow-hidden rounded-2xl border border-white/20 bg-black/55 shadow-lg">
              <View className="flex-row items-center gap-3 px-3.5 py-3">
                <SpeciesImage
                  catalogId={imageCatalogId}
                  scientificName={scientificForImage}
                  className="h-14 w-14 rounded-xl"
                  size="medium"
                />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Sparkles size={12} color="#c8893a" />
                    <Text className="font-sans-medium text-[10px] uppercase tracking-wide text-accent">
                      Live ID
                    </Text>
                  </View>
                  <Text
                    className="font-serif-semibold text-lg text-foreground"
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
                </View>
                <View className="items-end">
                  <Text className="font-mono text-sm text-primary">
                    {Math.round(primaryDetection.peakConfidence * 100)}%
                  </Text>
                  <Text className="font-sans text-[10px] text-muted-foreground">
                    match
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </>
  );
}
