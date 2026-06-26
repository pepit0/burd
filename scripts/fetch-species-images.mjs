import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "data", "bird-catalog.json");

/** Reads ids + scientific names from data/bird-catalog.json (run generate-bird-catalog first). */
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const species = catalog.map((entry) => [entry.id, entry.scientific_name]);

async function fetchInat(scientific) {
  const url =
    "https://api.inaturalist.org/v1/taxa?q=" +
    encodeURIComponent(scientific) +
    "&rank=species&per_page=1";
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const taxon = data.results?.[0];
  if (!taxon?.default_photo?.url) return null;
  return taxon.default_photo.url.replace("square", "medium");
}

const out = {};
let missing = 0;

for (const [id, scientific] of species) {
  const img = await fetchInat(scientific);
  out[id] = img;
  if (!img) missing += 1;
  console.log(id, img ? "ok" : "MISSING");
  await new Promise((r) => setTimeout(r, 200));
}

const lines = Object.entries(out).map(([id, url]) => {
  if (!url) return `  "${id}": null,`;
  return `  "${id}":\n    "${url}",`;
});

const contents = `/** Auto-generated iNaturalist default photos — run \`npm run fetch-species-images\` to refresh. */
export const SPECIES_IMAGE_URLS: Record<string, string | null> = {
${lines.join("\n")}
};
`;

const target = path.join(root, "lib", "speciesImageUrls.ts");
fs.writeFileSync(target, contents, "utf8");

console.log(`Wrote ${target} (${Object.keys(out).length} species, ${missing} missing)`);
