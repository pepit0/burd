import { resolveCatalogSpecies } from "@/lib/speciesCatalog";
import { lookupRegionalRarity } from "@/lib/rarity";
import { supabase } from "@/lib/supabase";
import type { DetectedBy, Rarity, SpeciesCard } from "@/types";

export interface SpeciesCardGrantInput {
  fromCamera: boolean;
  photoIdCatalogId: string | null;
  locationCountry: string | null;
}

export function speciesCardPlaceLine(
  city: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const parts = [city?.trim(), country?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

type SpeciesCardRow = Record<string, unknown> & {
  sightings?:
    | {
        latitude?: number | null;
        longitude?: number | null;
        observed_at?: string | null;
      }
    | {
        latitude?: number | null;
        longitude?: number | null;
        observed_at?: string | null;
      }[]
    | null;
};

function mapSpeciesCard(row: SpeciesCardRow): SpeciesCard {
  const nested = row.sightings;
  const sighting = Array.isArray(nested) ? nested[0] : nested;

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    species: row.species as string,
    scientific_name: row.scientific_name as string,
    catalog_id: row.catalog_id as string,
    photo_url: row.photo_url as string,
    location_city: (row.location_city as string | null) ?? null,
    location_country: (row.location_country as string | null) ?? null,
    sighting_id: (row.sighting_id as string | null) ?? null,
    unlocked_at: row.unlocked_at as string,
    latitude: sighting?.latitude ?? (row.latitude as number | null | undefined) ?? null,
    longitude: sighting?.longitude ?? (row.longitude as number | null | undefined) ?? null,
    observed_at:
      sighting?.observed_at ??
      (row.observed_at as string | null | undefined) ??
      null,
  };
}

export function rarityForSpeciesCard(card: SpeciesCard): Rarity {
  return lookupRegionalRarity({
    species: card.species,
    scientificName: card.scientific_name,
    lat: card.latitude ?? null,
    lng: card.longitude ?? null,
    observedAt: card.observed_at ?? card.unlocked_at,
  });
}

function isPhotoIdDetection(detectedBy: DetectedBy | string | null | undefined): boolean {
  return detectedBy === "image" || detectedBy === "both";
}

const SPECIES_CARD_SELECT =
  "id, user_id, species, scientific_name, catalog_id, photo_url, location_city, location_country, sighting_id, unlocked_at, sightings ( latitude, longitude, observed_at )";

export async function tryGrantSpeciesCard(input: {
  userId: string;
  sightingId: string;
  species: string;
  scientificName: string | null;
  photoUrl: string | null;
  detectedBy: DetectedBy | string | null | undefined;
  locationCity: string | null;
  locationCountry: string | null;
  latitude: number | null;
  longitude: number | null;
  observedAt: string | null;
  fromCamera: boolean;
  photoIdCatalogId: string | null;
}): Promise<SpeciesCard | null> {
  if (!input.fromCamera) return null;
  if (!isPhotoIdDetection(input.detectedBy)) return null;
  const photoUrl = input.photoUrl?.trim() ?? "";
  if (!photoUrl) return null;
  if (!input.photoIdCatalogId) return null;

  const catalog = resolveCatalogSpecies(input.species, input.scientificName);
  if (!catalog || catalog.id !== input.photoIdCatalogId) return null;

  try {
    const { data, error } = await supabase
      .from("species_cards")
      .upsert(
        {
          user_id: input.userId,
          species: catalog.species,
          scientific_name: catalog.scientific_name,
          catalog_id: catalog.id,
          photo_url: photoUrl,
          location_city: input.locationCity?.trim() || null,
          location_country: input.locationCountry?.trim() || null,
          sighting_id: input.sightingId,
        },
        { onConflict: "user_id,catalog_id", ignoreDuplicates: true },
      )
      .select(SPECIES_CARD_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapSpeciesCard({
      ...(data as SpeciesCardRow),
      latitude: input.latitude,
      longitude: input.longitude,
      observed_at: input.observedAt,
    });
  } catch (error) {
    console.warn("species card grant skipped", error);
    return null;
  }
}

export async function listSpeciesCards(userId: string): Promise<SpeciesCard[]> {
  const { data, error } = await supabase
    .from("species_cards")
    .select(SPECIES_CARD_SELECT)
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as SpeciesCardRow[]).map(mapSpeciesCard);
}

let seededCollectionCard: SpeciesCard | null = null;
const collectionRefreshListeners = new Set<() => void>();

export function seedSpeciesCollectionCard(card: SpeciesCard): void {
  seededCollectionCard = card;
  for (const listener of collectionRefreshListeners) {
    listener();
  }
}

export function takeSeededSpeciesCollectionCard(): SpeciesCard | null {
  const card = seededCollectionCard;
  seededCollectionCard = null;
  return card;
}

export function subscribeSpeciesCollectionRefresh(listener: () => void): () => void {
  collectionRefreshListeners.add(listener);
  return () => {
    collectionRefreshListeners.delete(listener);
  };
}

export function mergeSpeciesCardIntoList(
  card: SpeciesCard,
  list: SpeciesCard[],
): SpeciesCard[] {
  if (list.some((row) => row.id === card.id || row.catalog_id === card.catalog_id)) {
    return list;
  }
  return [card, ...list];
}

export async function deleteSpeciesCard(cardId: string): Promise<void> {
  const { error } = await supabase.from("species_cards").delete().eq("id", cardId);
  if (error) throw error;
}
