import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import {
  feedPhotoLayout,
  getImagePixelSize,
  SIGHTING_PHOTO_ASPECT,
  type FeedPhotoLayout,
} from "@/lib/sightingPhotoFrame";

const DEFAULT_LAYOUT: FeedPhotoLayout = {
  frameAspect: SIGHTING_PHOTO_ASPECT,
  imageAspect: SIGHTING_PHOTO_ASPECT,
  contentFit: "cover",
  useBlurredFill: false,
};

export function useFeedPhotoLayout(photoUrl: string | null | undefined): FeedPhotoLayout {
  const [layout, setLayout] = useState<FeedPhotoLayout>(DEFAULT_LAYOUT);

  useEffect(() => {
    if (!photoUrl) {
      setLayout(DEFAULT_LAYOUT);
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      getImagePixelSize(photoUrl)
        .then(({ width, height }) => {
          if (!cancelled) setLayout(feedPhotoLayout(width, height));
        })
        .catch(() => {
          if (!cancelled) setLayout(DEFAULT_LAYOUT);
        });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [photoUrl]);

  return layout;
}
