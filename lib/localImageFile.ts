import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

function cacheDest(ext = "jpg"): string {
  const dir = FileSystem.cacheDirectory ?? "";
  return `${dir}burd-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Camera-roll and remote URIs often cannot be read by FormData or the image
 * manipulator. Copy/download (or write base64) to a local cache file first.
 */
export async function ensureLocalImageUri(
  uri: string,
  base64?: string | null,
): Promise<string> {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error("Photo is missing.");
  }

  if (Platform.OS === "web") {
    return trimmed;
  }

  if (base64?.trim()) {
    const dest = cacheDest("jpg");
    await FileSystem.writeAsStringAsync(dest, base64.trim(), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return dest;
  }

  if (
    (trimmed.startsWith("file://") || trimmed.startsWith("/")) &&
    (await fileExists(trimmed))
  ) {
    return trimmed;
  }

  const dest = cacheDest("jpg");

  if (/^https?:\/\//i.test(trimmed)) {
    const result = await FileSystem.downloadAsync(trimmed, dest);
    if (result.status !== 200) {
      throw new Error("Could not download this photo.");
    }
    return result.uri;
  }

  try {
    await FileSystem.copyAsync({ from: trimmed, to: dest });
    return dest;
  } catch {
    return trimmed;
  }
}
