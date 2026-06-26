import type { CatalogSpecies } from "@/lib/speciesCatalog";
import { supabase } from "@/lib/supabase";

export interface FieldGuideAuthor {
  userId: string;
  username: string;
  fullName: string | null;
  authoredAt: string;
}

export async function fetchFieldGuideAuthor(
  species: CatalogSpecies,
): Promise<FieldGuideAuthor | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await supabase.rpc("get_species_field_guide_author", {
    in_scientific_name: species.scientific_name,
    in_common_name: species.species,
  });

  if (error || !data?.length) return null;

  const row = data[0] as {
    user_id: string;
    username: string;
    full_name: string | null;
    authored_at: string;
  };

  if (!row.user_id || !row.username) return null;

  return {
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    authoredAt: row.authored_at,
  };
}
