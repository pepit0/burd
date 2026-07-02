import { isInPhotoTaxonomy } from "@/lib/photoTaxonomy";
import { normalizeScientificName } from "@/lib/taxonomy";

/** Same id format as `data/photo-catalog.json` (`genus-epithet`, lowercase). */
export function catalogIdFromScientific(
  scientificName: string | null | undefined,
): string | null {
  const key = normalizeScientificName(scientificName);
  if (!key || !isInPhotoTaxonomy(key)) return null;
  const [genus, epithet] = key.split(/\s+/);
  if (!genus || !epithet) return null;
  return `${genus}-${epithet}`;
}
