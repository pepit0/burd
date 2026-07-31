import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

/** Matches post detail frames (4:5 portrait). */
export const SIGHTING_PHOTO_ASPECT = 4 / 5;

/** Feed cards cap very wide landscapes (width / height). */
export const FEED_MAX_ASPECT = 1.3;
/** Tallest feed frame — matches 4:5 so vertical shots do not dominate the scroll. */
export const FEED_MIN_ASPECT = SIGHTING_PHOTO_ASPECT;

export type FeedPhotoContentFit = "cover" | "contain";

export interface FeedPhotoLayout {
  frameAspect: number;
  imageAspect: number;
  contentFit: FeedPhotoContentFit;
  /** Tall photo in a shorter frame — blur-fill sides instead of gray bars. */
  useBlurredFill: boolean;
}

export function feedPhotoLayout(
  imageWidth: number,
  imageHeight: number,
): FeedPhotoLayout {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return {
      frameAspect: SIGHTING_PHOTO_ASPECT,
      imageAspect: SIGHTING_PHOTO_ASPECT,
      contentFit: "cover",
      useBlurredFill: false,
    };
  }

  const imageAspect = imageWidth / imageHeight;
  const frameAspect = clamp(imageAspect, FEED_MIN_ASPECT, FEED_MAX_ASPECT);
  const useBlurredFill = imageAspect + 0.01 < frameAspect;

  return {
    frameAspect,
    imageAspect,
    contentFit: useBlurredFill ? "contain" : "cover",
    useBlurredFill,
  };
}

export interface ImageCropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface CroppedSightingPhoto {
  uri: string;
  base64: string | null;
  width: number;
  height: number;
}

export async function getImagePixelSize(
  uri: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

export function centerCropRect(
  imageWidth: number,
  imageHeight: number,
  aspect = SIGHTING_PHOTO_ASPECT,
): ImageCropRect {
  const imageAspect = imageWidth / imageHeight;
  if (imageAspect > aspect) {
    const height = imageHeight;
    const width = height * aspect;
    return {
      originX: Math.round((imageWidth - width) / 2),
      originY: 0,
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  const width = imageWidth;
  const height = width / aspect;
  return {
    originX: 0,
    originY: Math.round((imageHeight - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function cropRectFromFrameTransform(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  scale: number,
  translateX: number,
  translateY: number,
): ImageCropRect {
  const cropWidth = frameWidth / scale;
  const cropHeight = frameHeight / scale;
  const originX = clamp(-translateX / scale, 0, imageWidth - cropWidth);
  const originY = clamp(-translateY / scale, 0, imageHeight - cropHeight);

  return {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(Math.min(cropWidth, imageWidth - originX)),
    height: Math.round(Math.min(cropHeight, imageHeight - originY)),
  };
}

export function minCoverScale(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): number {
  return Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
}

/** Scale that fits the entire image inside the frame (letterbox). */
export function minContainScale(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): number {
  return Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
}

export function panBounds(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  scale: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const scaledW = imageWidth * scale;
  const scaledH = imageHeight * scale;
  return {
    minX: Math.min(0, frameWidth - scaledW),
    maxX: Math.max(0, frameWidth - scaledW),
    minY: Math.min(0, frameHeight - scaledH),
    maxY: Math.max(0, frameHeight - scaledH),
  };
}

export function centerContainTransform(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): { scale: number; translateX: number; translateY: number } {
  const scale = minContainScale(imageWidth, imageHeight, frameWidth, frameHeight);
  const scaledW = imageWidth * scale;
  const scaledH = imageHeight * scale;
  return {
    scale,
    translateX: (frameWidth - scaledW) / 2,
    translateY: (frameHeight - scaledH) / 2,
  };
}

export function isFullPhotoVisible(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  scale: number,
): boolean {
  const containScale = minContainScale(imageWidth, imageHeight, frameWidth, frameHeight);
  return scale <= containScale * 1.02;
}

export function clampPan(
  translateX: number,
  translateY: number,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  scale: number,
): { translateX: number; translateY: number } {
  const bounds = panBounds(imageWidth, imageHeight, frameWidth, frameHeight, scale);
  return {
    translateX: clamp(translateX, bounds.minX, bounds.maxX),
    translateY: clamp(translateY, bounds.minY, bounds.maxY),
  };
}

export async function cropSightingPhoto(
  uri: string,
  crop: ImageCropRect,
  quality = 0.85,
): Promise<CroppedSightingPhoto> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ crop }], {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  return {
    uri: result.uri,
    base64: result.base64 ?? null,
    width: result.width,
    height: result.height,
  };
}

export async function exportSightingPhotoFromFrame(
  uri: string,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  scale: number,
  translateX: number,
  translateY: number,
  quality = 0.85,
): Promise<CroppedSightingPhoto> {
  if (isFullPhotoVisible(imageWidth, imageHeight, frameWidth, frameHeight, scale)) {
    const result = await ImageManipulator.manipulateAsync(uri, [], {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    return {
      uri: result.uri,
      base64: result.base64 ?? null,
      width: result.width,
      height: result.height,
    };
  }

  const crop = cropRectFromFrameTransform(
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    scale,
    translateX,
    translateY,
  );
  return cropSightingPhoto(uri, crop, quality);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
