import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import species from "../.pocket-bird-ref/src/species.js";

const HAT = {
  NONE: "none",
  TOP_HAT: "top-hat",
  FEZ: "fez",
  WIZARD_HAT: "wizard-hat",
  BASEBALL_CAP: "baseball-cap",
  FLOWER_HAT: "flower-hat",
  COWBOY_HAT: "cowboy-hat",
  BEANIE: "beanie",
  SUN_HAT: "sun-hat",
  VIKING_HELMET: "viking-helmet",
  STRAW_HAT: "straw-hat",
  CORDOVAN_HAT: "cordovan-hat",
};

const HAT_METADATA = {
  [HAT.NONE]: {
    name: "Invisible Hat",
    description: "It's like you're wearing nothing at all!",
  },
  [HAT.TOP_HAT]: {
    name: "Top Hat",
    description: "The mark of a true gentlebird.",
  },
  [HAT.VIKING_HELMET]: {
    name: "Viking Helmet",
    description:
      "Sure, vikings never actually wore this style of helmet, but why let facts get in the way of good fashion?",
  },
  [HAT.COWBOY_HAT]: {
    name: "Cowboy Hat",
    description: "You can't jam with the console cowboys without the appropriate attire.",
  },
  [HAT.FEZ]: {
    name: "Fez",
    description: "It's a fez. Fezzes are cool.",
  },
  [HAT.WIZARD_HAT]: {
    name: "Wizard Hat",
    description:
      "Grants the bearer terrifying mystical power, but luckily birds only use it to summon old ladies with bread crumbs.",
  },
  [HAT.BASEBALL_CAP]: {
    name: "Baseball Cap",
    description: "Birds unfortunately only ever hit 'fowl' balls...",
  },
  [HAT.FLOWER_HAT]: {
    name: "Flower Hat",
    description:
      "To be fair, this is less of a hat and more of a dirt clod that your pet happened to pick up.",
  },
  [HAT.BEANIE]: {
    name: "Beanie",
    description: "Keeps feathers warm on those long migrations south!",
  },
  [HAT.SUN_HAT]: {
    name: "Sun Hat",
    description: "Perfect for frolicking through enchanted flower fields.",
  },
  [HAT.STRAW_HAT]: {
    name: "Straw Hat",
    description:
      "A classic design, though keep away from water as this particular hat is seemingly unable to float.",
  },
  [HAT.CORDOVAN_HAT]: {
    name: "Cordovan Hat",
    description:
      "A traditional Spanish hat that stays put even in the wildest of sword fights.",
  },
};

const root = path.dirname(fileURLToPath(import.meta.url));
const birbJs = readFileSync(
  path.join(root, "../.pocket-bird-ref/dist/web/birb.js"),
  "utf8",
);

function extractJsonConst(source, name) {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Missing ${name}`);
  let i = start + marker.length;
  const open = source[i];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(source.slice(start + marker.length, i + 1));
      }
    }
  }
  throw new Error(`Unterminated ${name}`);
}

const outDir = path.join(root, "../data/pocket-bird");
mkdirSync(outDir, { recursive: true });

const payload = {
  version: 1,
  source: "https://github.com/IdreesInc/Pocket-Bird",
  license: "MPL-2.0",
  spriteWidth: 32,
  spriteHeight: 32,
  hatWidth: 12,
  birbPixels: extractJsonConst(birbJs, "BIRB_PIXELS"),
  hatPixels: extractJsonConst(birbJs, "HAT_PIXELS"),
  speciesPalettes: extractJsonConst(birbJs, "SPECIES_PALETTES"),
  hats: HAT,
  hatMetadata: HAT_METADATA,
  species,
};

writeFileSync(path.join(outDir, "assets.json"), JSON.stringify(payload));

console.log(
  `Wrote pocket-bird assets (${payload.birbPixels.length}x${payload.birbPixels[0]?.length}, ${Object.keys(payload.species).length} species, ${Object.keys(payload.hats).length - 1} hats)`,
);
