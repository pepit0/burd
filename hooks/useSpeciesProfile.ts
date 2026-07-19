import { useCallback, useEffect, useState } from "react";
import type { CatalogSpecies } from "@/lib/speciesCatalog";
import { getLoadErrorMessage, getUserFacingMessage } from "@/lib/errors";
import {
  fetchCachedSpeciesProfile,
  generateSpeciesProfile,
  hasDetailedFieldGuide,
  userHasPhotoSightingForSpecies,
} from "@/lib/speciesProfileLoad";
import { getCuratedSpeciesProfile, type SpeciesProfile } from "@/lib/speciesProfiles";
import type { Sighting } from "@/types";

interface UseSpeciesProfileOptions {
  authLoading: boolean;
  userId: string | null;
  sightings: Sighting[];
}

interface UseSpeciesProfileResult {
  profile: SpeciesProfile | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  fieldGuideLocked: boolean;
  hasPhotoSighting: boolean;
  generateFieldGuide: () => Promise<void>;
}

export function useSpeciesProfile(
  species: CatalogSpecies | undefined,
  { authLoading, userId, sightings }: UseSpeciesProfileOptions,
): UseSpeciesProfileResult {
  const [profile, setProfile] = useState<SpeciesProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPhotoSighting = species
    ? userHasPhotoSightingForSpecies(species, sightings)
    : false;

  const runGenerate = useCallback(async () => {
    if (!species) return;

    setGenerating(true);
    setError(null);

    try {
      const generated = await generateSpeciesProfile(species);
      setProfile(generated);
    } catch (err) {
      setError(
        getUserFacingMessage(err, "Couldn't generate this field guide. Please try again."),
      );
    } finally {
      setGenerating(false);
    }
  }, [species]);

  useEffect(() => {
    if (!species) {
      setProfile(null);
      setLoading(false);
      setGenerating(false);
      setError(null);
      return;
    }

    const curated = getCuratedSpeciesProfile(species.id);
    if (curated) {
      setProfile(curated);
      setLoading(false);
      setError(null);
      return;
    }

    if (authLoading) {
      setLoading(true);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCachedSpeciesProfile(species)
      .then((cached) => {
        if (cancelled) return;

        if (cached) {
          setProfile(cached);
          setLoading(false);
          return;
        }

        setProfile({
          family: species.family,
          size: "",
          habitat: "",
          range: "",
          diet: "",
          summary: "",
          field_marks: [],
          curated: false,
        });
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getLoadErrorMessage(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [species?.id, authLoading, userId]);

  useEffect(() => {
    if (!species || authLoading || loading || generating) return;
    if (getCuratedSpeciesProfile(species.id)) return;
    if (profile && hasDetailedFieldGuide(profile)) return;
    if (!hasPhotoSighting) return;

    void runGenerate();
  }, [
    species?.id,
    authLoading,
    loading,
    generating,
    hasPhotoSighting,
    profile,
    runGenerate,
  ]);

  const fieldGuideLocked = Boolean(
    species &&
      profile &&
      !getCuratedSpeciesProfile(species.id) &&
      !hasDetailedFieldGuide(profile),
  );

  return {
    profile,
    loading,
    generating,
    error,
    fieldGuideLocked,
    hasPhotoSighting,
    generateFieldGuide: runGenerate,
  };
}
