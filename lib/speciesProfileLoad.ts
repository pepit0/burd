import type { CatalogSpecies } from "@/lib/speciesCatalog";
import { resolveCatalogSpecies } from "@/lib/speciesCatalog";
import { getFunctionErrorMessage } from "@/lib/errors";
import { getSightingsForSpecies } from "@/lib/fieldGuide";
import {
  getCuratedSpeciesProfile,
  type SpeciesProfile,
} from "@/lib/speciesProfiles";
import { supabase } from "@/lib/supabase";
import type { Sighting } from "@/types";

interface SpeciesProfileRow {
  species_id: string;
  family: string | null;
  size: string;
  habitat: string;
  geographic_range: string;
  diet: string;
  summary: string;
  field_marks: string[] | null;
}

interface ProfileApiResponse {
  error?: string;
  family?: string;
  size?: string;
  habitat?: string;
  range?: string;
  diet?: string;
  summary?: string;
  field_marks?: string[];
  curated?: boolean;
}

const memoryCache = new Map<string, SpeciesProfile>();

function mapRow(row: SpeciesProfileRow, species: CatalogSpecies): SpeciesProfile {
  return {
    family: row.family?.trim() || species.family,
    size: row.size?.trim() ?? "",
    habitat: row.habitat?.trim() ?? "",
    range: row.geographic_range?.trim() ?? "",
    diet: row.diet?.trim() ?? "",
    summary: row.summary?.trim() ?? "",
    field_marks: Array.isArray(row.field_marks)
      ? row.field_marks.filter((mark) => typeof mark === "string" && mark.trim())
      : [],
    curated: false,
  };
}

function mapApiResponse(data: ProfileApiResponse, species: CatalogSpecies): SpeciesProfile {
  return {
    family: data.family?.trim() || species.family,
    size: data.size?.trim() ?? "",
    habitat: data.habitat?.trim() ?? "",
    range: data.range?.trim() ?? "",
    diet: data.diet?.trim() ?? "",
    summary: data.summary?.trim() ?? "",
    field_marks: Array.isArray(data.field_marks) ? data.field_marks : [],
    curated: false,
  };
}

export function hasDetailedFieldGuide(profile: SpeciesProfile): boolean {
  return Boolean(
    profile.habitat ||
      profile.range ||
      profile.diet ||
      profile.field_marks.length > 0,
  );
}

export function userHasPhotoSightingForSpecies(
  species: CatalogSpecies,
  sightings: Sighting[],
): boolean {
  return getSightingsForSpecies(species, sightings).some((sighting) =>
    Boolean(sighting.photo_url),
  );
}


async function readCachedProfileFromDb(
  species: CatalogSpecies,
): Promise<SpeciesProfile | null> {
  const { data: row, error } = await supabase
    .from("species_profiles")
    .select(
      "species_id, family, size, habitat, geographic_range, diet, summary, field_marks",
    )
    .eq("species_id", species.id)
    .maybeSingle();

  if (error || !row) return null;

  const profile = mapRow(row as SpeciesProfileRow, species);
  if (!hasDetailedFieldGuide(profile)) return null;

  memoryCache.set(species.id, profile);
  return profile;
}

/** Load shared field guide content — curated local or Supabase cache only. */
export async function fetchCachedSpeciesProfile(
  species: CatalogSpecies,
): Promise<SpeciesProfile | null> {
  const curated = getCuratedSpeciesProfile(species.id);
  if (curated) return curated;

  const cached = memoryCache.get(species.id);
  if (cached && hasDetailedFieldGuide(cached)) return cached;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  return readCachedProfileFromDb(species);
}

/** Generate and persist field guide content after a photo sighting. */
export async function generateSpeciesProfile(
  species: CatalogSpecies,
): Promise<SpeciesProfile> {
  const curated = getCuratedSpeciesProfile(species.id);
  if (curated) return curated;

  const cached = memoryCache.get(species.id);
  if (cached && hasDetailedFieldGuide(cached)) return cached;

  const existing = await readCachedProfileFromDb(species);
  if (existing) return existing;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error("Sign in to contribute the field guide for this species.");
  }

  const { data, error } = await supabase.functions.invoke<ProfileApiResponse>(
    "species-profile",
    {
      body: {
        species_id: species.id,
        common_name: species.species,
        scientific_name: species.scientific_name,
        family: species.family,
      },
    },
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data) {
    throw new Error("Could not generate species profile.");
  }

  const profile = mapApiResponse(data, species);
  if (!hasDetailedFieldGuide(profile)) {
    throw new Error("Could not generate species profile.");
  }

  memoryCache.set(species.id, profile);
  return profile;
}

/** After logging a sighting with a photo, generate the shared profile if needed. */
export async function maybeGenerateSpeciesProfileAfterSighting(
  species: string,
  scientificName: string | null,
  photoUrl: string | null,
): Promise<void> {
  if (!photoUrl) return;

  const catalogSpecies = resolveCatalogSpecies(species, scientificName);
  if (!catalogSpecies) return;

  if (getCuratedSpeciesProfile(catalogSpecies.id)) return;

  const cached = memoryCache.get(catalogSpecies.id);
  if (cached && hasDetailedFieldGuide(cached)) return;

  const existing = await readCachedProfileFromDb(catalogSpecies);
  if (existing) return;

  try {
    await generateSpeciesProfile(catalogSpecies);
  } catch {
    // Sighting was saved; profile generation can be retried from the species page.
  }
}

/** @deprecated Use fetchCachedSpeciesProfile or generateSpeciesProfile. */
export async function loadSpeciesProfile(
  species: CatalogSpecies,
): Promise<SpeciesProfile> {
  const cached = await fetchCachedSpeciesProfile(species);
  if (cached) return cached;
  return generateSpeciesProfile(species);
}
