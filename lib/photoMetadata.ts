import * as MediaLibrary from "expo-media-library";
import type { ImagePickerAsset } from "expo-image-picker";

function parseExifDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;

  // EXIF: "2024:06:25 15:30:00"
  const exifMatch = raw.match(
    /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );
  if (exifMatch) {
    return new Date(
      Number(exifMatch[1]),
      Number(exifMatch[2]) - 1,
      Number(exifMatch[3]),
      Number(exifMatch[4]),
      Number(exifMatch[5]),
      Number(exifMatch[6]),
    );
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function exifFromAsset(asset: ImagePickerAsset): Date | null {
  const exif = asset.exif as Record<string, unknown> | null | undefined;
  if (!exif) return null;

  return (
    parseExifDate(exif.DateTimeOriginal) ??
    parseExifDate(exif.DateTime) ??
    parseExifDate(exif.dateTimeOriginal) ??
    parseExifDate(exif.dateTime)
  );
}

/** When the photo was taken — EXIF first, then camera roll creation time. */
export async function photoTakenAt(asset: ImagePickerAsset): Promise<Date | null> {
  const fromExif = exifFromAsset(asset);
  if (fromExif) return fromExif;

  if (asset.assetId) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset.assetId);
      if (info.creationTime) {
        return new Date(info.creationTime);
      }
      const infoExif = info.exif as Record<string, unknown> | null | undefined;
      const fromLibraryExif =
        parseExifDate(infoExif?.DateTimeOriginal) ??
        parseExifDate(infoExif?.DateTime);
      if (fromLibraryExif) return fromLibraryExif;
    } catch {
      // fall through
    }
  }

  return null;
}
