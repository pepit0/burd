import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { GestureType } from "react-native-gesture-handler";
import { PinchZoomImage } from "@/components/PinchZoomImage";
import { IMAGE_OVERLAY_GRADIENT } from "@/components/ImageOverlayText";
import { SIGHTING_PHOTO_ASPECT } from "@/lib/sightingPhotoFrame";
import type { SightingPhoto } from "@/types";

interface SightingPhotoCarouselProps {
  photos: SightingPhoto[];
  aspectRatio?: number;
  imageAspect?: number;
  contentFit?: "cover" | "contain";
  useBlurredFill?: boolean;
  overlayGesture?: GestureType;
  /** Disable pinch in feeds so parent FlatList can scroll over photos. */
  pinchEnabled?: boolean;
  /** Single/double tap on photos (feed cards). */
  onPhotoPress?: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  renderOverlay?: (photo: SightingPhoto, index: number) => ReactNode;
  onIndexChange?: (index: number) => void;
}

export function SightingPhotoCarousel({
  photos,
  aspectRatio = SIGHTING_PHOTO_ASPECT,
  imageAspect = aspectRatio,
  contentFit = "contain",
  useBlurredFill = false,
  overlayGesture,
  pinchEnabled = true,
  onPhotoPress,
  className,
  style,
  renderOverlay,
  onIndexChange,
}: SightingPhotoCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [width, setWidth] = useState(screenWidth);
  const [index, setIndex] = useState(0);
  const height = width / aspectRatio;

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(nextIndex);
      onIndexChange?.(nextIndex);
    },
    [onIndexChange, width],
  );

  const slides = useMemo(() => photos.filter((photo) => photo.photo_url), [photos]);
  if (slides.length === 0) return null;

  const renderFeedPhoto = (uri: string, photoIndex: number) => {
    const foregroundWidth = useBlurredFill ? height * imageAspect : width;

    if (pinchEnabled || overlayGesture) {
      return (
        <PinchZoomImage
          uri={uri}
          width={useBlurredFill ? foregroundWidth : width}
          height={height}
          contentFit={contentFit}
          pinchEnabled={pinchEnabled}
          overlayGesture={photoIndex === 0 ? overlayGesture : undefined}
        />
      );
    }

    const image = (
      <Image
        source={{ uri }}
        style={
          useBlurredFill
            ? { width: foregroundWidth, height }
            : StyleSheet.absoluteFillObject
        }
        contentFit={contentFit}
        recyclingKey={uri}
      />
    );

    if (onPhotoPress) {
      return (
        <Pressable
          onPress={onPhotoPress}
          style={
            useBlurredFill
              ? { width: foregroundWidth, height, alignSelf: "center" }
              : { width, height }
          }
        >
          {image}
        </Pressable>
      );
    }

    return image;
  };

  return (
    <View
      className={className}
      style={style}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0) setWidth(nextWidth);
      }}
    >
      <ScrollView
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {slides.map((photo, photoIndex) => (
          <View key={photo.id} style={{ width, height, overflow: "hidden" }}>
            {useBlurredFill ? (
              <Image
                source={{ uri: photo.photo_url }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                blurRadius={28}
                recyclingKey={`${photo.photo_url}-blur`}
              />
            ) : null}
            <View
              style={
                useBlurredFill
                  ? { flex: 1, alignItems: "center", justifyContent: "center" }
                  : { width, height }
              }
            >
              {renderFeedPhoto(photo.photo_url, photoIndex)}
            </View>
            {renderOverlay ? (
              <>
                <LinearGradient
                  colors={[...IMAGE_OVERLAY_GRADIENT]}
                  className="absolute inset-0"
                  pointerEvents="none"
                />
                {renderOverlay(photo, photoIndex)}
              </>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {slides.length > 1 ? (
        <View
          className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1"
          pointerEvents="none"
        >
          <Text className="font-mono text-xs text-white">
            {index + 1}/{slides.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
