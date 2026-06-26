import type { Rarity } from "@/types";

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
};

/**
 * Regional frequency baselines for North American species.
 * Used when community sighting data is sparse and as a floor so notable
 * birds (e.g. Bald Eagle) are never labeled "common" by default.
 * Keys are lowercase common or scientific names.
 */
const BASELINES: Record<string, Rarity> = {
  // Eagles & large raptors
  "haliaeetus leucocephalus": "uncommon",
  "bald eagle": "uncommon",
  "haliaeetus albicilla": "rare",
  "white-tailed eagle": "rare",
  "aquila chrysaetos": "rare",
  "golden eagle": "rare",
  "aquila audax": "rare",
  "wedge-tailed eagle": "rare",

  // Hawks & falcons
  "buteo jamaicensis": "uncommon",
  "red-tailed hawk": "uncommon",
  "buteo lineatus": "uncommon",
  "red-shouldered hawk": "uncommon",
  "accipiter cooperii": "uncommon",
  "cooper's hawk": "uncommon",
  "accipiter gentilis": "uncommon",
  "northern goshawk": "rare",
  "accipiter striatus": "uncommon",
  "sharp-shinned hawk": "uncommon",
  "circus hudsonius": "uncommon",
  "northern harrier": "uncommon",
  "buteo lagopus": "rare",
  "rough-legged hawk": "rare",
  "buteo swainsoni": "uncommon",
  "swainson's hawk": "uncommon",
  "falco peregrinus": "uncommon",
  "peregrine falcon": "uncommon",
  "falco sparverius": "uncommon",
  "american kestrel": "uncommon",
  "falco columbarius": "uncommon",
  "merlin": "uncommon",
  "falco rusticolus": "rare",
  "gyrfalcon": "rare",

  // Owls
  "bubo scandiacus": "rare",
  "snowy owl": "rare",
  "bubo virginianus": "uncommon",
  "great horned owl": "uncommon",
  "strix varia": "uncommon",
  "barred owl": "uncommon",
  "strix occidentalis": "rare",
  "spotted owl": "rare",
  "asio otus": "uncommon",
  "long-eared owl": "uncommon",
  "asio flammeus": "uncommon",
  "short-eared owl": "uncommon",
  "tyto alba": "uncommon",
  "barn owl": "uncommon",
  "aegolius acadicus": "rare",
  "northern saw-whet owl": "rare",

  // Notable passerines & others
  "bombycilla cedrorum": "uncommon",
  "cedar waxwing": "uncommon",
  "icterus galbula": "uncommon",
  "baltimore oriole": "uncommon",
  "passerina cyanea": "rare",
  "indigo bunting": "rare",
  "passerina ciris": "rare",
  "painted bunting": "rare",
  "cardinalis sinuatus": "rare",
  "pyrrhuloxia": "rare",
  "dryocopus pileatus": "uncommon",
  "pileated woodpecker": "uncommon",
  "melanerpes erythrocephalus": "uncommon",
  "red-headed woodpecker": "uncommon",
  "antigone canadensis": "uncommon",
  "sandhill crane": "uncommon",
  "grus americana": "rare",
  "whooping crane": "rare",
  "phoenicopterus ruber": "rare",
  "american flamingo": "rare",
  "pelecanus occidentalis": "uncommon",
  "brown pelican": "uncommon",
  "pelecanus erythrorhynchos": "uncommon",
  "american white pelican": "uncommon",
  "gavia immer": "uncommon",
  "common loon": "uncommon",
  "gavia pacifica": "uncommon",
  "pacific loon": "uncommon",
};

export function lookupBaselineRarity(
  species: string,
  scientificName: string | null,
): Rarity | null {
  const candidates = [
    scientificName?.trim().toLowerCase(),
    species.trim().toLowerCase(),
  ].filter(Boolean) as string[];

  for (const key of candidates) {
    const hit = BASELINES[key];
    if (hit) return hit;
  }
  return null;
}

export function maxRarity(a: Rarity, b: Rarity): Rarity {
  return RARITY_RANK[a] >= RARITY_RANK[b] ? a : b;
}

export function computeCommunityRarity(
  recent: { species: string; scientific_name: string | null }[],
  species: string,
  scientificName: string | null,
): Rarity | null {
  const speciesCount = recent.filter((s) =>
    matchesSpecies(s, species, scientificName),
  ).length;

  if (speciesCount === 0) {
    return "uncommon";
  }

  const share = speciesCount / recent.length;
  if (speciesCount <= 1 && share < 0.05) {
    return "rare";
  }
  if (share < 0.12) {
    return "uncommon";
  }
  return "common";
}

function matchesSpecies(
  sighting: { species: string; scientific_name: string | null },
  species: string,
  scientificName: string | null,
): boolean {
  if (scientificName && sighting.scientific_name) {
    return (
      sighting.scientific_name.toLowerCase() === scientificName.toLowerCase()
    );
  }
  return sighting.species.toLowerCase() === species.toLowerCase();
}
