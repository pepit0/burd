import { useEffect, useSyncExternalStore, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import { Feather } from "lucide-react-native";
import {
  isFieldGuideImageAllowed,
  scheduleFieldGuideImage,
  subscribeFieldGuideImage,
} from "@/lib/fieldGuideImageLoader";
import {
  resolveSpeciesImageUrl,
  speciesImageUrl,
  type SpeciesImageSize,
} from "@/lib/speciesImages";

interface SpeciesImageProps {
  catalogId: string;
  scientificName: string;
  /** Field guide grid: queue photo fetch via fieldGuideImageLoader. */
  gridLoader?: boolean;
  size?: SpeciesImageSize;
  className?: string;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  zoom?: number;
}

const ZOOM_BY_SIZE: Record<SpeciesImageSize, number> = {
  medium: 1.2,
  large: 1.12,
  original: 1.08,
};

function useGridImageAllowed(catalogId: string, enabled: boolean): boolean {
  return useSyncExternalStore(
    (listener) => subscribeFieldGuideImage(catalogId, listener),
    () => (enabled ? isFieldGuideImageAllowed(catalogId) : true),
    () => (enabled ? isFieldGuideImageAllowed(catalogId) : true),
  );
}

export function SpeciesImage({
  catalogId,
  scientificName,
  gridLoader = false,
  size = "medium",
  className,
  style,
  contentFit = "cover",
  zoom,
}: SpeciesImageProps) {
  const [uri, setUri] = useState(
    () => speciesImageUrl(catalogId, size) ?? null,
  );

  const canFetch = useGridImageAllowed(catalogId, gridLoader);

  useEffect(() => {
    if (!gridLoader) return;
    scheduleFieldGuideImage(catalogId);
  }, [gridLoader, catalogId]);

  useEffect(() => {
    const baked = speciesImageUrl(catalogId, size);
    if (baked) {
      setUri(baked);
      return;
    }

    if (gridLoader && !canFetch) return;

    let cancelled = false;
    resolveSpeciesImageUrl(catalogId, scientificName, size).then((url) => {
      if (!cancelled) setUri(url);
    });

    return () => {
      cancelled = true;
    };
  }, [catalogId, scientificName, size, gridLoader, canFetch]);

  const scale = zoom ?? ZOOM_BY_SIZE[size];

  if (!uri) {
    return (
      <View
        className={`items-center justify-center bg-muted ${className ?? ""}`}
        style={style}
      >
        <Feather size={24} color="#3a4e35" />
      </View>
    );
  }

  return (
    <View className={className} style={[{ overflow: "hidden" }, style]}>
      <Image
        source={{ uri }}
        style={{
          width: "100%",
          height: `${scale * 100}%`,
        }}
        contentFit={contentFit}
        contentPosition="top"
        transition={200}
        recyclingKey={catalogId}
      />
    </View>
  );
}
