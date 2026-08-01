import { supabase } from "@/lib/supabase";
import { isPocketBirdSpeciesId } from "@/lib/pocketBird/matchSpecies";
import { DEFAULT_PET } from "@/lib/pocketBird/petStorage";
import type { Profile } from "@/types";

export interface ProfilePetSettingsUpdate {
  pet_species_id?: string | null;
  profile_pet_enabled?: boolean;
}

export async function updateProfilePetSettings(
  userId: string,
  fields: ProfilePetSettingsUpdate,
): Promise<void> {
  const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
  if (error) throw error;
}

export async function updateProfilePetSpecies(
  userId: string,
  speciesId: string,
): Promise<void> {
  await updateProfilePetSettings(userId, { pet_species_id: speciesId });
}

export function resolveProfilePetSpeciesId(
  profile: Pick<Profile, "pet_species_id"> | null | undefined,
  localOverride?: string | null,
): string {
  const candidate = localOverride?.trim() || profile?.pet_species_id?.trim();
  if (candidate && isPocketBirdSpeciesId(candidate)) {
    return candidate;
  }
  return DEFAULT_PET;
}

export function isProfilePetVisible(
  profile: Pick<Profile, "profile_pet_enabled"> | null | undefined,
): boolean {
  return profile?.profile_pet_enabled !== false;
}

export function profilePetDefaults(profile: Profile | null): {
  profilePetEnabled: boolean;
  petSpeciesId: string;
} {
  return {
    profilePetEnabled: profile?.profile_pet_enabled !== false,
    petSpeciesId: resolveProfilePetSpeciesId(profile),
  };
}

export function defaultProfilePetSpeciesId(): string {
  return DEFAULT_PET;
}
