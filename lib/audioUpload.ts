import { readLocalFileBytes } from "@/lib/localFileBytes";

export function audioUploadMeta(localUri: string): {
  ext: string;
  contentType: string;
} {
  const rawExt = localUri.split(".").pop()?.split("?")[0]?.toLowerCase();
  switch (rawExt) {
    case "wav":
      return { ext: "wav", contentType: "audio/wav" };
    case "mp3":
      return { ext: "mp3", contentType: "audio/mpeg" };
    case "caf":
      return { ext: "caf", contentType: "audio/x-caf" };
    case "3gp":
      return { ext: "3gp", contentType: "audio/3gpp" };
    case "m4a":
      return { ext: "m4a", contentType: "audio/mp4" };
    default:
      return { ext: rawExt || "m4a", contentType: "audio/mp4" };
  }
}

/** Read a local recording into bytes for Supabase Storage upload. */
export async function readLocalAudioBytes(localUri: string): Promise<ArrayBuffer> {
  return readLocalFileBytes(localUri);
}
