import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/bird-catalog.json"), "utf8"));
const calls = JSON.parse(fs.readFileSync(path.join(root, "data/species-calls.json"), "utf8"));
const missing = catalog.filter((c) => !calls[c.id]);

const UA = "BurdFieldGuide/1.0 (diagnostic)";
const AUDIO = /\.(mp3|ogg|wav|flac|m4a)$/i;

function isCommercial(blob) {
  const b = blob.toLowerCase();
  if (b.includes("public domain") || b.includes("cc0")) return true;
  if (b.includes("nc") || b.includes("nd")) return false;
  if (b.includes("by-sa") || b.includes("cc-by")) return true;
  return false;
}

async function commons(params) {
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({ format: "json", origin: "*", ...params });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

async function diagnoseSpecies(scientific) {
  const search = await commons({
    action: "query",
    list: "search",
    srnamespace: "6",
    srlimit: "8",
    srsearch: `"${scientific}"`,
  });
  const audioTitles = (search.query?.search ?? [])
    .map((h) => h.title)
    .filter((t) => AUDIO.test(t));

  if (audioTitles.length === 0) {
    return { scientific, status: "no_commons_audio" };
  }

  const meta = await commons({
    action: "query",
    titles: audioTitles.slice(0, 3).join("|"),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
  });

  const pages = Object.values(meta.query?.pages ?? {});
  const licenses = pages.map((p) => {
    const m = p.imageinfo?.[0]?.extmetadata ?? {};
    const lic = m.LicenseShortName?.value ?? m.License?.value ?? "?";
    const ok = isCommercial(`${lic} ${m.LicenseUrl?.value ?? ""}`);
    return { title: p.title, lic, ok };
  });

  const commercial = licenses.filter((l) => l.ok);
  if (commercial.length > 0) {
    return { scientific, status: "has_commercial_not_matched", commercial };
  }
  if (licenses.length > 0) {
    return { scientific, status: "only_nc_or_blocked", licenses };
  }
  return { scientific, status: "no_metadata" };
}

const sample = missing.slice(0, 12);
console.log(`Diagnosing ${sample.length} missing species (of ${missing.length} total)…\n`);

const counts = {};
for (const entry of sample) {
  await new Promise((r) => setTimeout(r, 400));
  const result = await diagnoseSpecies(entry.scientific_name);
  counts[result.status] = (counts[result.status] ?? 0) + 1;
  console.log(entry.id, "→", result.status, result.licenses?.[0]?.lic ?? "");
}

console.log("\nSample breakdown:", counts);
