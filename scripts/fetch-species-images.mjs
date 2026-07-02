import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const birdsOnly = args.includes("--birds-only");
const limitIdx = args.indexOf("--limit");
const limit =
  limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1] ?? "", 10) : null;

const catalogPath = path.join(
  root,
  "data",
  birdsOnly ? "bird-catalog.json" : "photo-catalog.json",
);
const outPath = path.join(root, "data", "species-image-urls.json");

/** Prefer CC0 / CC-BY (not NC) or iNat open-data CDN URLs. */
function isCommercialPhoto(photo) {
  const url = photo?.url ?? "";
  if (url.includes("inaturalist-open-data.s3.amazonaws.com")) return true;
  const code = photo?.license_code ?? "";
  if (code === "CC0" || code === "CC0-1.0") return true;
  if (code.startsWith("CC-BY") && !code.includes("NC")) return true;
  return false;
}

async function fetchInat(scientific) {
  const url =
    "https://api.inaturalist.org/v1/taxa?q=" +
    encodeURIComponent(scientific) +
    "&rank=species&per_page=1";
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const taxon = data.results?.[0];
  const photo = taxon?.default_photo;
  if (!photo?.url || !isCommercialPhoto(photo)) return null;
  return photo.url.replace("square", "medium");
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
let species = catalog.map((entry) => [entry.id, entry.scientific_name]);
if (limit != null && Number.isFinite(limit) && limit > 0) {
  species = species.slice(0, limit);
}

const existing = fs.existsSync(outPath)
  ? JSON.parse(fs.readFileSync(outPath, "utf8"))
  : {};

const out = { ...existing };
let missing = 0;
let skipped = 0;

console.log(
  `Fetching ${species.length} species from ${path.basename(catalogPath)}…`,
);

for (const [id, scientific] of species) {
  if (out[id] && !args.includes("--refresh")) {
    skipped += 1;
    continue;
  }
  const img = await fetchInat(scientific);
  if (img) {
    out[id] = img;
  } else {
    missing += 1;
    if (!out[id]) delete out[id];
  }
  console.log(id, img ? "ok" : "MISSING");
  await new Promise((r) => setTimeout(r, 200));
}

fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

console.log(
  `Wrote ${outPath} (${Object.keys(out).length} urls, ${missing} missing this run, ${skipped} skipped)`,
);
