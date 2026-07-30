import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SIGHTING_PHOTO_ASPECT,
  centerContainTransform,
  exportSightingPhotoFromFrame,
  getImagePixelSize,
  type CroppedSightingPhoto,
} from "@/lib/sightingPhotoFrame";

interface SightingPhotoCropModalProps {
  visible: boolean;
  uri: string | null;
  onCancel: () => void;
  onConfirm: (photo: CroppedSightingPhoto) => void;
}

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

export function SightingPhotoCropModal({
  visible,
  uri,
  onCancel,
  onConfirm,
}: SightingPhotoCropModalProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const frameWidth = screenWidth - 32;
  const frameHeight = frameWidth / SIGHTING_PHOTO_ASPECT;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const imageW = useSharedValue(0);
  const imageH = useSharedValue(0);
  const frameW = useSharedValue(frameWidth);
  const frameH = useSharedValue(frameHeight);

  const applyContainTransform = useCallback(
    (width: number, height: number) => {
      const transform = centerContainTransform(width, height, frameWidth, frameHeight);
      scale.value = transform.scale;
      translateX.value = transform.translateX;
      translateY.value = transform.translateY;
    },
    [frameHeight, frameWidth, scale, translateX, translateY],
  );

  useEffect(() => {
    frameW.value = frameWidth;
    frameH.value = frameHeight;
  }, [frameH, frameW, frameHeight, frameWidth]);

  useEffect(() => {
    if (!visible || !uri) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setImageSize(null);

    (async () => {
      try {
        const size = await getImagePixelSize(uri);
        if (cancelled) return;
        setImageSize(size);
        imageW.value = size.width;
        imageH.value = size.height;
        applyContainTransform(size.width, size.height);
      } catch {
        if (!cancelled) {
          setError("Could not load this photo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyContainTransform, imageH, imageW, uri, visible]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startX.value = translateX.value;
          startY.value = translateY.value;
        })
        .onUpdate((event) => {
          const scaledW = imageW.value * scale.value;
          const scaledH = imageH.value * scale.value;
          const minX = Math.min(0, frameW.value - scaledW);
          const maxX = Math.max(0, frameW.value - scaledW);
          const minY = Math.min(0, frameH.value - scaledH);
          const maxY = Math.max(0, frameH.value - scaledH);
          translateX.value = clamp(startX.value + event.translationX, minX, maxX);
          translateY.value = clamp(startY.value + event.translationY, minY, maxY);
        }),
    [frameH, frameW, imageH, imageW, scale, startX, startY, translateX, translateY],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          startScale.value = scale.value;
        })
        .onUpdate((event) => {
          const minScale = Math.min(
            frameW.value / imageW.value,
            frameH.value / imageH.value,
          );
          const maxScale =
            Math.max(
              frameW.value / imageW.value,
              frameH.value / imageH.value,
              minScale,
            ) * 4;
          const nextScale = clamp(startScale.value * event.scale, minScale, maxScale);
          const prevScale = scale.value;
          const ratio = nextScale / prevScale;

          const focalX = frameW.value / 2;
          const focalY = frameH.value / 2;
          const nextX = focalX - (focalX - translateX.value) * ratio;
          const nextY = focalY - (focalY - translateY.value) * ratio;

          scale.value = nextScale;
          const scaledW = imageW.value * nextScale;
          const scaledH = imageH.value * nextScale;
          const minX = Math.min(0, frameW.value - scaledW);
          const maxX = Math.max(0, frameW.value - scaledW);
          const minY = Math.min(0, frameH.value - scaledH);
          const maxY = Math.max(0, frameH.value - scaledH);
          translateX.value = clamp(nextX, minX, maxX);
          translateY.value = clamp(nextY, minY, maxY);
        }),
    [
      frameH,
      frameW,
      imageH,
      imageW,
      scale,
      startScale,
      translateX,
      translateY,
    ],
  );

  const gesture = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture],
  );

  const imageStyle = useAnimatedStyle(() => ({
    width: imageW.value * scale.value,
    height: imageH.value * scale.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  function handleFitFullPhoto() {
    if (!imageSize) return;
    applyContainTransform(imageSize.width, imageSize.height);
  }

  async function handleConfirm() {
    if (!uri || !imageSize || saving) return;

    setSaving(true);
    try {
      const cropped = await exportSightingPhotoFromFrame(
        uri,
        imageSize.width,
        imageSize.height,
        frameWidth,
        frameHeight,
        scale.value,
        translateX.value,
        translateY.value,
      );
      onConfirm(cropped);
    } catch {
      setError("Could not save this photo. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-background">
        <View
          className="flex-row items-center justify-between border-b border-border px-4 pb-3"
          style={{ paddingTop: Math.max(insets.top, 12) }}
        >
          <Pressable onPress={onCancel} disabled={saving} className="px-1 py-1">
            <Text className="font-sans-medium text-base text-muted-foreground">Cancel</Text>
          </Pressable>
          <Text className="font-serif-semibold text-base text-foreground">Adjust photo</Text>
          <Pressable
            onPress={handleConfirm}
            disabled={loading || saving || !imageSize || Boolean(error)}
            className="px-1 py-1"
          >
            <Text className="font-sans-semibold text-base text-primary">
              {saving ? "Saving…" : "Done"}
            </Text>
          </Pressable>
        </View>

        <View
          className="flex-1 items-center justify-center px-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Text className="mb-4 text-center font-sans text-sm text-muted-foreground">
            Pinch to zoom in on the bird, or zoom out to show the full photo. Posts keep the
            whole image visible unless you crop in closer.
          </Text>

          <View
            className="overflow-hidden rounded-2xl border border-border bg-muted"
            style={{ width: frameWidth, height: frameHeight }}
          >
            {loading ? (
              <View className="h-full w-full items-center justify-center">
                <ActivityIndicator color="#5f9470" />
              </View>
            ) : error ? (
              <View className="h-full w-full items-center justify-center px-6">
                <Text className="text-center font-sans text-sm text-muted-foreground">
                  {error}
                </Text>
              </View>
            ) : uri && imageSize ? (
              <GestureDetector gesture={gesture}>
                <Animated.View style={{ flex: 1 }}>
                  <Animated.View style={imageStyle}>
                    <Image
                      source={{ uri }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="fill"
                    />
                  </Animated.View>
                </Animated.View>
              </GestureDetector>
            ) : null}
          </View>

          {!loading && imageSize ? (
            <Pressable
              onPress={handleFitFullPhoto}
              disabled={saving}
              className="mt-4 rounded-full border border-border px-4 py-2 active:opacity-80"
            >
              <Text className="font-sans-medium text-sm text-primary">Fit full photo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
