import { Platform } from "react-native";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";

/** Read a local file URI into bytes (recordings, photos, etc.). */
export async function readLocalFileBytes(localUri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    const response = await fetch(localUri);
    if (!response.ok) {
      throw new Error("Could not read the local file.");
    }
    return response.arrayBuffer();
  }

  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) {
    throw new Error("Local file is missing.");
  }

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decode(base64);
}
