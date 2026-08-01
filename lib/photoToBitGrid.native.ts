import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode as decodeBase64 } from "base64-arraybuffer";
import { decode as decodeJpeg } from "jpeg-js";
import { COLONY_BIT_GRID, bitPixelsFromRgba, type BitPixel } from "@/lib/colonyBitArt";

async function downloadToCache(url: string, key: string): Promise<string> {
  const target = `${FileSystem.cacheDirectory ?? ""}colony-bit-src-${key}.jpg`;
  const info = await FileSystem.getInfoAsync(target);
  if (info.exists) return target;
  const result = await FileSystem.downloadAsync(url, target);
  return result.uri;
}

async function sampleLocalImage(localUri: string): Promise<BitPixel[] | null> {
  const resized = await manipulateAsync(
    localUri,
    [{ resize: { width: COLONY_BIT_GRID } }],
    { compress: 1, format: SaveFormat.JPEG, base64: true },
  );

  if (!resized.base64) return null;

  const side = Math.min(resized.width, resized.height);
  const originX = Math.max(0, Math.floor((resized.width - side) / 2));
  const originY = Math.max(0, Math.floor((resized.height - side) / 2));

  const cropped = await manipulateAsync(
    resized.uri,
    [{ crop: { originX, originY, width: side, height: side } }],
    { compress: 1, format: SaveFormat.JPEG, base64: true },
  );

  if (!cropped.base64) return null;

  let finalBase64 = cropped.base64;
  if (cropped.width !== COLONY_BIT_GRID || cropped.height !== COLONY_BIT_GRID) {
    const squared = await manipulateAsync(
      cropped.uri,
      [{ resize: { width: COLONY_BIT_GRID, height: COLONY_BIT_GRID } }],
      { compress: 1, format: SaveFormat.JPEG, base64: true },
    );
    if (!squared.base64) return null;
    finalBase64 = squared.base64;
  }

  const raw = decodeBase64(finalBase64);
  const decoded = decodeJpeg(new Uint8Array(raw), { useTArray: true });
  return bitPixelsFromRgba(decoded.width, decoded.height, decoded.data);
}

/** Sample a species photo into a retro pixel grid (native). */
export async function photoToBitGrid(imageUrl: string): Promise<BitPixel[] | null> {
  try {
    const key = imageUrl.replace(/[^a-z0-9]/gi, "_").slice(-80);
    const localUri = await downloadToCache(imageUrl, key);
    return sampleLocalImage(localUri);
  } catch {
    return null;
  }
}
