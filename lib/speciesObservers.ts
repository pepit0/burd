import type { CatalogSpecies } from "@/lib/speciesCatalog";
import { supabase } from "@/lib/supabase";

export interface SpeciesObserver {
  userId: string;
  username: string;
  fullName: string | null;
  avatarColor: string;
  avatarUrl: string | null;
  isVerified: boolean;
  isBeta: boolean;
  firstSeenAt: string;
}

export async function fetchSpeciesObservers(
  species: CatalogSpecies,
): Promise<SpeciesObserver[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return [];

  const { data, error } = await supabase.rpc("get_species_observers", {
    in_scientific_name: species.scientific_name,
    in_common_name: species.species,
  });

  if (error || !data?.length) return [];

  return (data as {
    user_id: string;
    username: string;
    full_name: string | null;
    avatar_color: string;
    avatar_url: string | null;
    is_verified: boolean;
    is_beta: boolean;
    first_seen_at: string;
  }[])
    .filter((row) => row.user_id && row.username)
    .map((row) => ({
      userId: row.user_id,
      username: row.username,
      fullName: row.full_name,
      avatarColor: row.avatar_color,
      avatarUrl: row.avatar_url,
      isVerified: Boolean(row.is_verified),
      isBeta: Boolean(row.is_beta),
      firstSeenAt: row.first_seen_at,
    }));
}
