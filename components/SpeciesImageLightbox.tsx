import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { PinchZoomView } from "@/components/PinchZoomImage";
import {
  resolveSpeciesImageDimensions,
  resolveSpeciesImageUrl,
  speciesImageUrl,
} from "@/lib/speciesImages";

export interface ImageOriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

export interface SpeciesImageLightboxTarget {
  catalogId: string | null;
  scientificName: string;
  commonName: string;
  scientificLabel?: string | null;
}

export interface SpeciesImageLightboxRequest {
  target: SpeciesImageLightboxTarget;
  originRect: ImageOriginRect;
}

interface SpeciesImageLightboxProps {
  request: SpeciesImageLightboxRequest | null;
  onDismiss: () => void;
}

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");
const OPEN_MS = 340;
const CLOSE_MS = 280;
const CAPTION_HEIGHT = 76;

interface ImageLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeExpandedLayout(
  imageWidth: number,
  imageHeight: number,
  insets: { top: number; bottom: number },
): ImageLayout {
  const maxWidth = WINDOW_WIDTH;
  const maxHeight =
    WINDOW_HEIGHT - insets.top - insets.bottom - CAPTION_HEIGHT - 16;
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const x = (WINDOW_WIDTH - width) / 2;
  const bandTop = insets.top + 8;
  const bandBottom = WINDOW_HEIGHT - insets.bottom - CAPTION_HEIGHT - 8;
  const y = bandTop + (bandBottom - bandTop - height) / 2;
  return { x, y, width, height };
}

export function SpeciesImageLightbox({ request, onDismiss }: SpeciesImageLightboxProps) {
  const insets = useSafeAreaInsets();
  const [activeRequest, setActiveRequest] = useState<SpeciesImageLightboxRequest | null>(
    null,
  );
  const [imageUri, setImageUri] = useState<string | null>(null);
  const closingRef = useRef(false);

  const progress = useSharedValue(0);
  const backdrop = useSharedValue(0);
  const ready = useSharedValue(0);

  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const originW = useSharedValue(0);
  const originH = useSharedValue(0);
  const originRadius = useSharedValue(8);

  const finalX = useSharedValue(0);
  const finalY = useSharedValue(0);
  const finalW = useSharedValue(0);
  const finalH = useSharedValue(0);

  const finishDismiss = useCallback(() => {
    closingRef.current = false;
    ready.value = 0;
    setActiveRequest(null);
    setImageUri(null);
    onDismiss();
  }, [onDismiss, ready]);

  const runCloseAnimation = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    backdrop.value = withTiming(0, { duration: CLOSE_MS });
    progress.value = withTiming(
      0,
      { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(finishDismiss)();
        }
      },
    );
  }, [backdrop, finishDismiss, progress]);

  useEffect(() => {
    if (request) {
      closingRef.current = false;
      setActiveRequest(request);
      return;
    }

    if (activeRequest) {
      runCloseAnimation();
    }
  }, [request, activeRequest, runCloseAnimation]);

  useEffect(() => {
    if (!activeRequest) return;

    let cancelled = false;
    progress.value = 0;
    backdrop.value = 0;
    ready.value = 0;
    setImageUri(null);

    const { originRect, target } = activeRequest;
    originX.value = originRect.x;
    originY.value = originRect.y;
    originW.value = originRect.width;
    originH.value = originRect.height;
    originRadius.value = originRect.borderRadius ?? 8;

    const { catalogId, scientificName } = target;
    const previewUri =
      speciesImageUrl(catalogId, scientificName, "medium") ??
      speciesImageUrl(catalogId, scientificName, "large");
    if (previewUri) {
      setImageUri(previewUri);
      ready.value = 1;
    }

    void (async () => {
      const uri =
        speciesImageUrl(catalogId, scientificName, "original") ??
        (await resolveSpeciesImageUrl(catalogId, scientificName, "original"));
      const dimensions = await resolveSpeciesImageDimensions(catalogId, scientificName);
      if (cancelled) return;

      const layout = computeExpandedLayout(
        dimensions.width,
        dimensions.height,
        insets,
      );

      finalX.value = layout.x;
      finalY.value = layout.y;
      finalW.value = layout.width;
      finalH.value = layout.height;

      setImageUri(uri);
      ready.value = 1;
      backdrop.value = withTiming(1, { duration: OPEN_MS });
      progress.value = withTiming(1, {
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeRequest,
    insets,
    backdrop,
    progress,
    ready,
    originX,
    originY,
    originW,
    originH,
    originRadius,
    finalX,
    finalY,
    finalW,
    finalH,
  ]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(backdrop.value, [0, 1], [0, 0.9]),
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: ready.value,
    position: "absolute",
    left: interpolate(progress.value, [0, 1], [originX.value, finalX.value]),
    top: interpolate(progress.value, [0, 1], [originY.value, finalY.value]),
    width: interpolate(progress.value, [0, 1], [originW.value, finalW.value]),
    height: interpolate(progress.value, [0, 1], [originH.value, finalH.value]),
    borderRadius: interpolate(progress.value, [0, 1], [originRadius.value, 0]),
    overflow: "hidden",
  }));

  const captionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.55, 1], [0, 1]),
    transform: [
      {
        translateY: interpolate(progress.value, [0.55, 1], [8, 0]),
      },
    ],
  }));

  if (!activeRequest) {
    return null;
  }

  const { target } = activeRequest;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={runCloseAnimation}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={runCloseAnimation}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        </Pressable>

        {imageUri ? (
          <Animated.View style={imageStyle}>
            <PinchZoomView className="h-full w-full">
              <Image
                source={{ uri: imageUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={0}
                recyclingKey={imageUri}
              />
            </PinchZoomView>
          </Animated.View>
        ) : null}

        <Animated.View
          pointerEvents="none"
          style={[
            styles.caption,
            { paddingBottom: insets.bottom + 8 },
            captionStyle,
          ]}
        >
          <Text className="text-center font-serif-semibold text-lg text-white">
            {target.commonName}
          </Text>
          {target.scientificLabel ? (
            <Text className="mt-0.5 text-center font-serif-italic text-sm text-white/70">
              {target.scientificLabel}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "#000",
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
