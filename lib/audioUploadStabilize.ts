import * as FileSystem from "expo-file-system/legacy";
import { audioUploadMeta } from "@/lib/audioUpload";

const RETRY_DELAYS_MS = [0, 50, 150, 300];

async function waitForReadableFile(uri: string): Promise<void> {
  let lastError: Error | null = null;

  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && "size" in info && info.size != null && info.size > 0) {
        return;
      }
      lastError = new Error("Audio clip is empty or still being written.");
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Audio clip is missing.");
    }
  }

  throw lastError ?? new Error("Audio clip is missing.");
}

/**
 * expo-av temp URIs can be unreadable for a moment after stopAndUnloadAsync.
 * Copy to a stable cache path before multipart upload so fetch can stream bytes.
 */
export async function stabilizeAudioForUpload(uri: string): Promise<string> {
  await waitForReadableFile(uri);

  if (uri.includes("live-upload-") || uri.includes("live-overlap-")) {
    return uri;
  }

  const { ext } = audioUploadMeta(uri);
  const dest = `${FileSystem.cacheDirectory}live-upload-${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  await waitForReadableFile(dest);
  return dest;
}
