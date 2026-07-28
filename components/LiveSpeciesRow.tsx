import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { SpeciesImage } from "@/components/SpeciesImage";
import type { ImageOriginRect } from "@/components/SpeciesImageLightbox";
import {
  displayScientificName,
  displaySpeciesName,
} from "@/lib/predictionLabels";
import type { LiveDetection } from "@/lib/liveSoundSession";

interface LiveSpeciesRowProps {
  detection: LiveDetection;
  isExpiring: boolean;
  selectable?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  showConfidence?: boolean;
  onPress?: () => void;
  onImagePress?: (originRect: ImageOriginRect) => void;
}

export function LiveSpeciesRow({
  detection,
  isExpiring,
  selectable = false,
  selected = false,
  highlighted = false,
  showConfidence = true,
  onPress,
  onImagePress,
}: LiveSpeciesRowProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const imageAnchorRef = useRef<View>(null);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isExpiring ? 0 : 1,
      duration: isExpiring ? 600 : 350,
      useNativeDriver: true,
    }).start();
  }, [isExpiring, opacity]);

  useEffect(() => {
    Animated.timing(highlightAnim, {
      toValue: highlighted ? 1 : 0,
      duration: highlighted ? 180 : 400,
      useNativeDriver: false,
    }).start();
  }, [highlightAnim, highlighted]);

  const borderColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#e8e4d9", "#c8893a"],
  });
  const backgroundColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#faf8f2", "rgba(200, 137, 58, 0.14)"],
  });

  const commonName = displaySpeciesName(detection.prediction);
  const scientificName = displayScientificName(detection.prediction);
  const scientificForImage =
    detection.prediction.scientific_name ?? scientificName ?? commonName;

  function handleImagePress() {
    if (!onImagePress) return;
    imageAnchorRef.current?.measureInWindow((x, y, width, height) => {
      onImagePress({ x, y, width, height, borderRadius: 8 });
    });
  }

  const thumbnail = (
    <SpeciesImage
      catalogId={detection.catalogId ?? "unknown-bird"}
      scientificName={scientificForImage}
      className="h-12 w-12 rounded-lg"
      size="medium"
    />
  );

  const details = (
    <>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-serif text-base text-foreground">{commonName}</Text>
          {selected ? (
            <Text className="rounded bg-primary/20 px-1.5 py-0.5 font-sans-medium text-[10px] text-primary">
              Primary
            </Text>
          ) : null}
          {highlighted && !selected ? (
            <Text className="rounded bg-accent/25 px-1.5 py-0.5 font-sans-medium text-[10px] text-accent">
              Now
            </Text>
          ) : null}
        </View>
        {scientificName ? (
          <Text className="font-serif-italic text-xs text-muted-foreground">
            {scientificName}
          </Text>
        ) : null}
      </View>
      {showConfidence ? (
        <Text className="font-mono text-[10px] text-muted-foreground">
          {Math.round(detection.peakConfidence * 100)}%
        </Text>
      ) : null}
    </>
  );

  const splitRow = (
    <View className="flex-row items-center gap-3">
      {onImagePress ? (
        <Pressable
          onPress={handleImagePress}
          className="active:opacity-80"
          hitSlop={4}
          accessibilityLabel={`Enlarge photo of ${commonName}`}
          accessibilityRole="button"
        >
          <View ref={imageAnchorRef} collapsable={false}>
            {thumbnail}
          </View>
        </Pressable>
      ) : (
        thumbnail
      )}
      {onPress ? (
        <Pressable
          onPress={onPress}
          className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-90"
          accessibilityLabel={`Open field guide for ${commonName}`}
          accessibilityRole="button"
        >
          {details}
        </Pressable>
      ) : (
        <View className="min-w-0 flex-1 flex-row items-center gap-3">{details}</View>
      )}
    </View>
  );

  const wholeRowPressable = onPress ? (
    <Pressable onPress={onPress} className="active:opacity-90">
      <View className="flex-row items-center gap-3">
        {thumbnail}
        {details}
      </View>
    </Pressable>
  ) : (
    <View className="flex-row items-center gap-3">
      {thumbnail}
      {details}
    </View>
  );

  const rowBody = onImagePress ? splitRow : wholeRowPressable;

  const row = highlighted ? (
    <Animated.View
      style={{ borderColor, backgroundColor }}
      className="rounded-xl border-2 px-3 py-3"
    >
      {rowBody}
    </Animated.View>
  ) : (
    <View
      className={`rounded-xl border px-3 py-3 ${
        selected ? "border-primary bg-primary/10" : "border-border bg-card"
      }`}
    >
      {rowBody}
    </View>
  );

  return <Animated.View style={{ opacity }}>{row}</Animated.View>;
}
