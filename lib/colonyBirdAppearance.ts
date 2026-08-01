import type { FieldGuideEntry } from "@/lib/fieldGuide";
import { getCatalogSpeciesById } from "@/lib/speciesCatalog";
import { SPECIES_PROFILES } from "@/lib/speciesProfiles";
import type { BirdArchetype } from "@/lib/colonyBirdShapes";

const FAMILY_ARCHETYPE: Record<string, BirdArchetype> = {
  Anatidae: "duck",
  Anhimidae: "duck",
  Podicipedidae: "duck",
  Phoenicopteridae: "wader",
  Ardeidae: "wader",
  Threskiornithidae: "wader",
  Ciconiidae: "wader",
  Charadriidae: "wader",
  Haematopodidae: "wader",
  Recurvirostridae: "wader",
  Scolopacidae: "wader",
  Jacanidae: "wader",
  Rallidae: "wader",
  Gruidae: "wader",
  Accipitridae: "raptor",
  Pandionidae: "raptor",
  Falconidae: "raptor",
  Cathartidae: "raptor",
  Strigidae: "raptor",
  Trochilidae: "hummingbird",
  Picidae: "woodpecker",
  Indicatoridae: "woodpecker",
  Hirundinidae: "swallow",
  Apodidae: "swallow",
  Phasianidae: "gamebird",
  Odontophoridae: "gamebird",
  Cracidae: "gamebird",
  Meleagrididae: "gamebird",
  Columbidae: "gamebird",
};

const GENUS_ARCHETYPE: Record<string, BirdArchetype> = {
  Anas: "duck",
  Aythya: "duck",
  Branta: "duck",
  Cygnus: "duck",
  Meleagris: "gamebird",
  Colinus: "gamebird",
  Buteo: "raptor",
  Accipiter: "raptor",
  Falco: "raptor",
  Aquila: "raptor",
  Haliaeetus: "raptor",
  Archilochus: "hummingbird",
  Calypte: "hummingbird",
  Dryocopus: "woodpecker",
  Picoides: "woodpecker",
  Melanerpes: "woodpecker",
  Hirundo: "swallow",
  Petrochelidon: "swallow",
  Egretta: "wader",
  Ardea: "wader",
  Tringa: "wader",
  Charadrius: "wader",
  Pluvialis: "wader",
};

export interface BirdAppearance {
  archetype: BirdArchetype;
  body: string;
  wing: string;
  belly: string;
  beak: string;
  leg: string;
  tail: string;
  crest: string;
  mark: string;
}

interface ColorRule {
  pattern: RegExp;
  colors: Partial<Omit<BirdAppearance, "archetype">>;
}

const COLOR_RULES: ColorRule[] = [
  { pattern: /cardinal|vermilion|scarlet|tanager(?!.*yellow)/i, colors: { body: "#c62828", wing: "#8e1c1c", belly: "#d84343", crest: "#c62828" } },
  { pattern: /blue(jay|bird)?|indigo|cyan|kingfisher|jay\b/i, colors: { body: "#2f6eb5", wing: "#1e4f8a", belly: "#cfe4ff", mark: "#ffffff" } },
  { pattern: /robin\b/i, colors: { body: "#4a4a52", wing: "#3a3a42", belly: "#d4652f", mark: "#ffffff" } },
  { pattern: /goldfinch|yellow(warbler|throat|hammer|legs)?|\byellow\b/i, colors: { body: "#e6c229", wing: "#2f4535", belly: "#f5df6a", mark: "#2f4535" } },
  { pattern: /oriole|baltimore|bullock/i, colors: { body: "#ef6c00", wing: "#2f4535", belly: "#ffb74d", mark: "#ffffff" } },
  { pattern: /red(-|\s)?(bellied|headed|shouldered|wing|poll|breasted|tailed)/i, colors: { body: "#5f6368", wing: "#424548", mark: "#c62828", belly: "#eceff1" } },
  { pattern: /woodpecker|flicker|sapsucker/i, colors: { body: "#2f2f2f", wing: "#ffffff", belly: "#f5f0e1", mark: "#c62828", beak: "#e8dcc8" } },
  { pattern: /crow|raven|blackbird|cormorant|grackle|cowbird|anhinga/i, colors: { body: "#1a1d1a", wing: "#101210", belly: "#2a2f2a", beak: "#3a3a3a" } },
  { pattern: /snow(y)?\s+(goose|bunting|owl)|snow goose|egret|ibis|gull|tern|pelican|swan\b|white/i, colors: { body: "#f2f0ea", wing: "#e0ddd4", belly: "#ffffff", beak: "#f0a030", mark: "#2f4535" } },
  { pattern: /mallard|teal|duck|goose|wigeon|merganser/i, colors: { body: "#4a7a5c", wing: "#2f5240", belly: "#d4a574", mark: "#1e5c8a", beak: "#f0a030" } },
  { pattern: /heron|egret|stork|crane|sandhill|avocet|plover|curlew|godwit|snipe|killdeer/i, colors: { body: "#8a9098", wing: "#6e747c", belly: "#eceff1", leg: "#f0a030", beak: "#f0a030" } },
  { pattern: /hawk|eagle|falcon|kite|osprey|vulture|harrier|buzzard/i, colors: { body: "#6b4f2d", wing: "#4a3520", belly: "#d4a574", beak: "#f0c060", mark: "#ffffff" } },
  { pattern: /hummingbird/i, colors: { body: "#2f8a6a", wing: "#6e7a3a", belly: "#cfeecf", mark: "#c62828", beak: "#181e16" } },
  { pattern: /sparrow|junco|towhee|finch|grosbeak|bunting(?!.*indigo)/i, colors: { body: "#8a6e3a", wing: "#6e5630", belly: "#e8dcc8", mark: "#4a3520" } },
  { pattern: /warbler/i, colors: { body: "#c8a03a", wing: "#5f9470", belly: "#fff8e7", mark: "#2f4535" } },
  { pattern: /owl/i, colors: { body: "#8a6e3a", wing: "#6e5630", belly: "#e8dcc8", mark: "#2f4535", beak: "#e8dcc8" } },
  { pattern: /turkey|quail|grouse|pheasant|partridge/i, colors: { body: "#6b4f2d", wing: "#4a3520", belly: "#d4a574", mark: "#2f4535", crest: "#c62828" } },
  { pattern: /swallow|swift/i, colors: { body: "#2f2f35", wing: "#1a1d22", belly: "#8a6e72", mark: "#c62828" } },
  { pattern: /hummingbird|archilochus|calypte/i, colors: { body: "#2f8a6a", wing: "#8a6e3a", mark: "#c62828" } },
];

const DEFAULTS: Omit<BirdAppearance, "archetype"> = {
  body: "#5f9470",
  wing: "#4a7a5c",
  belly: "#e8dcc8",
  beak: "#f0c060",
  leg: "#c8693a",
  tail: "#4a7a5c",
  crest: "#5f9470",
  mark: "#2f4535",
};

function genusFromScientific(scientificName: string): string | null {
  const parts = scientificName.trim().split(/\s+/);
  return parts[0] ?? null;
}

export function archetypeFromEntry(entry: FieldGuideEntry): BirdArchetype {
  const genus = genusFromScientific(entry.scientific_name);
  if (genus && GENUS_ARCHETYPE[genus]) {
    return GENUS_ARCHETYPE[genus];
  }
  if (entry.family && FAMILY_ARCHETYPE[entry.family]) {
    return FAMILY_ARCHETYPE[entry.family];
  }

  const haystack = `${entry.species} ${entry.scientific_name}`;
  if (/duck|goose|swan|teal|merganser|wigeon|mallard/i.test(haystack)) return "duck";
  if (/heron|egret|stork|crane|plover|sandpiper|avocet|curlew|snipe|killdeer/i.test(haystack)) return "wader";
  if (/hawk|eagle|falcon|kite|osprey|vulture|owl/i.test(haystack)) return "raptor";
  if (/hummingbird/i.test(haystack)) return "hummingbird";
  if (/woodpecker|flicker|sapsucker/i.test(haystack)) return "woodpecker";
  if (/turkey|quail|grouse|pheasant|partridge|dove|pigeon/i.test(haystack)) return "gamebird";
  if (/swallow|swift/i.test(haystack)) return "swallow";

  return "songbird";
}

function applyFieldMarks(
  base: Omit<BirdAppearance, "archetype">,
  fieldMarks: string[],
): Omit<BirdAppearance, "archetype"> {
  const out = { ...base };
  const text = fieldMarks.join(" ").toLowerCase();

  if (/red|orange|rust/i.test(text)) {
    out.belly = out.belly === DEFAULTS.belly ? "#d4652f" : out.belly;
    out.mark = "#c62828";
  }
  if (/blue/i.test(text)) {
    out.body = "#2f6eb5";
    out.wing = "#1e4f8a";
  }
  if (/yellow/i.test(text)) {
    out.body = "#e6c229";
    out.wing = "#2f4535";
  }
  if (/white/i.test(text)) {
    out.mark = "#ffffff";
    out.belly = "#ffffff";
  }
  if (/black/i.test(text)) {
    out.body = "#2a2f2a";
    out.wing = "#181e16";
  }
  if (/crest/i.test(text)) {
    out.crest = out.body;
  }

  return out;
}

export function appearanceForEntry(entry: FieldGuideEntry): BirdAppearance {
  const archetype = archetypeFromEntry(entry);
  let colors = { ...DEFAULTS };

  const haystack = `${entry.species} ${entry.scientific_name}`;
  for (const rule of COLOR_RULES) {
    if (rule.pattern.test(haystack)) {
      colors = { ...colors, ...rule.colors };
      break;
    }
  }

  const catalog = getCatalogSpeciesById(entry.id);
  const profile = SPECIES_PROFILES[entry.id];
  if (profile?.field_marks.length) {
    colors = applyFieldMarks(colors, profile.field_marks);
  } else if (catalog) {
    colors = applyFieldMarks(colors, [entry.species, entry.family]);
  }

  return { archetype, ...colors };
}
