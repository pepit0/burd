import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { GestureType } from "react-native-gesture-handler";
import { PinchZoomImage } from "@/components/PinchZoomImage";
import { IMAGE_OVERLAY_GRADIENT } from "@/components/ImageOverlayText";
import { SIGHTING_PHOTO_ASPECT } from "@/lib/sightingPhotoFrame";
import type { SightingPhoto } from "@/types";

interface SightingPhotoCarouselProps {
  photos: SightingPhoto[];
  aspectRatio?: number;
  contentFit?: "cover" | "contain";
  overlayGesture?: GestureType;
  className?: string;
  style?: StyleProp<ViewStyle>;
  renderOverlay?: (photo: SightingPhoto, index: number) => ReactNode;
  onIndexChange?: (index: number) => void;
}

export function SightingPhotoCarousel({
  photos,
  aspectRatio = SIGHTING_PHOTO_ASPECT,
  contentFit = "contain",
  overlayGesture,
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
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {slides.map((photo, photoIndex) => (
          <View key={photo.id} style={{ width, height }}>
            <PinchZoomImage
              uri={photo.photo_url}
              width={width}
              height={height}
              contentFit={contentFit}
              overlayGesture={photoIndex === 0 ? overlayGesture : undefined}
            />
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
