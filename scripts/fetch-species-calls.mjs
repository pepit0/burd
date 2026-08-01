import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** Load XENO_CANTO_API_KEY etc. from gitignored `.env` for build scripts. */
function loadDotEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

const args = process.argv.slice(2);
const useBulk = !args.includes("--sequential");
const missingOnly = args.includes("--missing-only");
const skipGapFill = args.includes("--no-gap-fill");
const limitIdx = args.indexOf("--limit");
const limit =
  limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1] ?? "", 10) : null;
const idsIdx = args.indexOf("--ids");
const idFilter =
  idsIdx >= 0 ? (args[idsIdx + 1] ?? "").split(",").filter(Boolean) : null;

const catalogPath = path.join(root, "data", "bird-catalog.json");
const outPath = path.join(root, "data", "species-calls.json");
const xcKey = process.env.XENO_CANTO_API_KEY?.trim() || null;

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  "BurdFieldGuide/1.0 (species-calls build; +https://github.com/burd-app/burd)";
const AUDIO_EXT = /\.(mp3|ogg|wav|flac|m4a)$/i;
const REQUEST_GAP_MS = 600;
const BULK_PAGE_SIZE = 500;
const BULK_PAGE_GAP_MS = 200;
const GAP_FILL_CONCURRENCY = 4;
const DEEP_SEARCH_MAX_PAGES = 120;

/** Commercial use OK: CC0, CC-BY, CC-BY-SA. Reject NC and ND. */
function isCommercialAudioLicense(meta) {
  const shortName = (meta?.LicenseShortName?.value ?? "").toLowerCase();
  const license = (meta?.License?.value ?? "").toLowerCase();
  const licenseUrl = (meta?.LicenseUrl?.value ?? "").toLowerCase();
  const blob = `${shortName} ${license} ${licenseUrl}`;

  if (blob.includes("public domain") || blob.includes("cc0") || blob.includes("cc-zero")) {
    return true;
  }
  if (blob.includes("nc") || blob.includes("nd")) return false;
  if (blob.includes("cc-by-sa") || blob.includes("by-sa")) return true;
  if (blob.includes("cc-by") || blob.includes(" attribution ")) return true;
  return false;
}

function parseCallType(description) {
  const match = description.match(/\bType:\s*([^\n<]+)/i);
  return match?.[1]?.trim() ?? null;
}

function parseXcId(title, credit) {
  const fromTitle = title.match(/XC(\d+)/i);
  if (fromTitle) return fromTitle[1];
  const fromCredit = (credit ?? "").match(/xeno-canto\.org\/(\d+)/i);
  return fromCredit?.[1] ?? null;
}

function parseLicenseLabel(url) {
  if (!url) return "Open license";
  const lower = url.toLowerCase();
  if (lower.includes("zero") || lower.includes("/cc0")) return "CC0 1.0";
  if (lower.includes("by-sa/4")) return "CC BY-SA 4.0";
  if (lower.includes("by-sa/3")) return "CC BY-SA 3.0";
  if (lower.includes("/by/4")) return "CC BY 4.0";
  if (lower.includes("/by/3")) return "CC BY 3.0";
  if (lower.includes("/by/2.5")) return "CC BY 2.5";
  return "Creative Commons";
}

function catalogIdFromScientific(scientificName) {
  const key = scientificName.trim().toLowerCase().replace(/_/g, " ");
  const [genus, epithet] = key.split(/\s+/).filter(Boolean);
  if (!genus || !epithet) return null;
  return `${genus}-${epithet}`;
}

function parseScientificFromTitle(title) {
  const name = title.replace(/^File:/, "");
  const match = name.match(/^([A-Z][a-z]+)[ _]([a-z]+(?:-[a-z]+)?)/);
  if (!match) return null;
  return `${match[1]} ${match[2].replace(/-/g, "")}`;
}

function callPriority(call) {
  const type = (call.callType ?? "").toLowerCase();
  if (type.includes("song")) return 0;
  if (type.includes("call")) return 1;
  return 2;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function continueParams(data) {
  if (!data?.continue) return null;
  const params = { ...data.continue };
  delete params.warnings;
  return Object.keys(params).length > 0 ? params : null;
}

async function commonsGet(params, attempt = 0) {
  const url = `${COMMONS_API}?${new URLSearchParams({
    format: "json",
    origin: "*",
    maxlag: "5",
    ...params,
  }).toString()}`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (res.status === 429 && attempt < 6) {
    await sleep(2000 * (attempt + 1));
    return commonsGet(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
}

function entryFromPage(page) {
  const info = page.imageinfo?.[0];
  if (!info?.url || !AUDIO_EXT.test(page.title ?? "")) return null;

  const meta = info.extmetadata ?? {};
  if (!isCommercialAudioLicense(meta)) return null;

  const description = meta.ImageDescription?.value ?? "";
  const credit = meta.Credit?.value ?? "";

  return {
    audioUrl: info.url,
    recordist:
      meta.Artist?.value?.replace(/<[^>]+>/g, "").trim() || "Unknown recordist",
    license: meta.LicenseShortName?.value ?? parseLicenseLabel(meta.LicenseUrl?.value),
    licenseUrl: meta.LicenseUrl?.value ?? null,
    sourceUrl: info.descriptionurl ?? info.descriptionshorturl ?? null,
    callType: parseCallType(description),
    xcId: parseXcId(page.title ?? "", credit),
  };
}

function keepBetterCall(existing, candidate) {
  if (!existing) return candidate;
  return callPriority(candidate) < callPriority(existing) ? candidate : existing;
}

function ingestPages(pages, wanted, found) {
  for (const wikiPage of pages) {
    const scientific = parseScientificFromTitle(wikiPage.title ?? "");
    if (!scientific) continue;

    const catalogId = catalogIdFromScientific(scientific);
    if (!catalogId || !wanted.has(catalogId)) continue;

    const call = entryFromPage(wikiPage);
    if (!call) continue;

    found.set(catalogId, keepBetterCall(found.get(catalogId), call));
  }
}

async function bulkFetchFromXenoCantoCategory(catalogIds) {
  const wanted = new Set(catalogIds);
  const found = new Map();
  let pagination = null;
  let page = 0;
  let scanned = 0;

  console.log(
    `Bulk scan: Category:Xeno-canto (${wanted.size} catalog species to match)…`,
  );

  while (true) {
    page += 1;
    const params = {
      action: "query",
      generator: "categorymembers",
      gcmtitle: "Category:Xeno-canto",
      gcmtype: "file",
      gcmlimit: String(BULK_PAGE_SIZE),
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      ...(pagination ?? {}),
    };

    const data = await commonsGet(params);
    const pages = Object.values(data.query?.pages ?? {});
    if (pages.length === 0) break;

    scanned += pages.length;
    ingestPages(pages, wanted, found);

    if (page % 20 === 0) {
      console.log(
        `  page ${page}: scanned ${scanned} files, matched ${found.size}/${wanted.size} species`,
      );
    }

    pagination = continueParams(data);
    if (!pagination?.gcmcontinue) break;
    await sleep(BULK_PAGE_GAP_MS);
  }

  console.log(
    `Bulk scan done: ${scanned} files scanned, ${found.size} species with calls`,
  );
  return found;
}

async function bulkSearchDeepcat(catalogIds, found) {
  const wanted = new Set(catalogIds);
  let offset = 0;
  let page = 0;
  let scanned = 0;

  console.log(`Deep search: deepcat:"Xeno-canto" (gap supplement)…`);

  while (true) {
    page += 1;
    const data = await commonsGet({
      action: "query",
      list: "search",
      srnamespace: "6",
      srlimit: "50",
      srsearch: 'deepcat:"Xeno-canto" insource:XC',
      sroffset: String(offset),
    });

    const hits = (data.query?.search ?? []).filter((hit) => AUDIO_EXT.test(hit.title));
    if (hits.length === 0 && !data.continue?.sroffset) break;

    for (let i = 0; i < hits.length; i += 50) {
      const batch = hits.slice(i, i + 50).map((h) => h.title);
      const meta = await commonsGet({
        action: "query",
        titles: batch.join("|"),
        prop: "imageinfo",
        iiprop: "url|extmetadata",
      });
      scanned += batch.length;
      ingestPages(Object.values(meta.query?.pages ?? {}), wanted, found);
      await sleep(BULK_PAGE_GAP_MS);
    }

    if (page % 40 === 0) {
      console.log(`  deep page ${page}: scanned ${scanned} hits, matched ${found.size} species`);
    }

    if (!data.continue?.sroffset) break;
    offset = data.continue.sroffset;
    if (page >= DEEP_SEARCH_MAX_PAGES) {
      console.log(`  deep search capped at ${DEEP_SEARCH_MAX_PAGES} pages`);
      break;
    }
    await sleep(BULK_PAGE_GAP_MS);
  }

  console.log(`Deep search done: ${scanned} hits scanned, ${found.size} species total`);
  return found;
}

async function searchAudioFiles(scientificName) {
  const queries = [`"${scientificName}"`, `${scientificName} XC`, `${scientificName} bird`];

  const titles = new Set();
  for (const srsearch of queries) {
    const data = await commonsGet({
      action: "query",
      list: "search",
      srnamespace: "6",
      srlimit: "15",
      srsearch,
    });
    for (const hit of data.query?.search ?? []) {
      if (AUDIO_EXT.test(hit.title)) titles.add(hit.title);
    }
    if (titles.size > 0) break;
    await sleep(REQUEST_GAP_MS);
  }

  return [...titles];
}

async function fetchFilesMetadata(titles) {
  if (titles.length === 0) return [];

  const data = await commonsGet({
    action: "query",
    titles: titles.join("|"),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
  });

  const pages = Object.values(data.query?.pages ?? {});
  return pages.map(entryFromPage).filter(Boolean);
}

async function fetchFromCommons(scientificName) {
  const titles = await searchAudioFiles(scientificName);
  if (titles.length === 0) return null;

  const matches = await fetchFilesMetadata(titles.slice(0, 15));
  matches.sort((a, b) => callPriority(a) - callPriority(b));
  return matches[0] ?? null;
}

function isCommercialXcLicense(lic) {
  const lower = (lic ?? "").toLowerCase();
  if (!lower) return false;
  if (lower.includes("nc") || lower.includes("nd")) return false;
  if (lower.includes("cc0") || lower.includes("zero")) return true;
  if (lower.includes("by-sa") || lower.includes("/by/")) return true;
  return false;
}

async function fetchFromXenoCanto(scientificName) {
  if (!xcKey) return null;

  const parts = scientificName.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const [gen, sp] = parts;

  const query = `gen:${gen} sp:${sp} (lic:cc-by OR lic:cc0 OR lic:cc-by-sa) q:A`;
  const url = `https://xeno-canto.org/api/3/recordings?query=${encodeURIComponent(query)}&key=${encodeURIComponent(xcKey)}`;

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;

  const data = await res.json();
  const recording = data.recordings?.[0];
  if (!recording?.id || !isCommercialXcLicense(recording.lic)) return null;

  const licenseUrl = recording.lic?.startsWith("//")
    ? `https:${recording.lic}`
    : recording.lic;

  return {
    audioUrl: `https://xeno-canto.org/${recording.id}/download`,
    recordist: recording.rec ?? "Unknown recordist",
    license: parseLicenseLabel(licenseUrl),
    licenseUrl,
    sourceUrl: recording.url?.startsWith("//")
      ? `https:${recording.url}`
      : recording.url ?? `https://xeno-canto.org/${recording.id}`,
    callType: recording.type ?? null,
    xcId: String(recording.id),
  };
}

async function fetchCallSequential(scientificName) {
  const commons = await fetchFromCommons(scientificName);
  if (commons) return commons;
  return fetchFromXenoCanto(scientificName);
}

async function gapFillSpecies(ids, catalogById, out) {
  let found = 0;
  let missing = 0;
  let index = 0;

  async function worker() {
    while (index < ids.length) {
      const i = index++;
      const id = ids[i];
      const scientific = catalogById.get(id)?.scientific_name;
      if (!scientific) continue;

      try {
        const call = await fetchCallSequential(scientific);
        if (call) {
          out[id] = call;
          found += 1;
          console.log(`  gap ${id} ok`);
        } else {
          missing += 1;
        }
      } catch {
        missing += 1;
      }

      await sleep(REQUEST_GAP_MS);
    }
  }

  console.log(
    `Gap fill: searching Commons${xcKey ? " + Xeno-canto" : ""} for ${ids.length} species (${GAP_FILL_CONCURRENCY} workers)…`,
  );

  await Promise.all(Array.from({ length: GAP_FILL_CONCURRENCY }, () => worker()));
  console.log(`Gap fill done: ${found} found, ${missing} still missing`);
  return found;
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));

let targetIds = catalog.map((entry) => entry.id);
if (idFilter?.length) {
  targetIds = targetIds.filter((id) => idFilter.includes(id));
}
if (limit != null && Number.isFinite(limit) && limit > 0) {
  targetIds = targetIds.slice(0, limit);
}

const existing = fs.existsSync(outPath)
  ? JSON.parse(fs.readFileSync(outPath, "utf8"))
  : {};

const out = { ...existing };
let found = 0;
let missing = 0;
let skipped = 0;

if (useBulk && !idFilter?.length) {
  const idsToMatch = missingOnly
    ? targetIds.filter((id) => !out[id])
    : targetIds;

  const bulkResults = await bulkFetchFromXenoCantoCategory(idsToMatch);

  if (bulkResults.size < idsToMatch.length * 0.85) {
    await bulkSearchDeepcat(idsToMatch, bulkResults);
  }

  for (const [id, call] of bulkResults) {
    if (out[id] && !args.includes("--refresh")) {
      skipped += 1;
      continue;
    }
    out[id] = call;
    found += 1;
  }

  if (!skipGapFill) {
    const gapIds = args.includes("--refresh")
      ? idsToMatch.filter((id) => !bulkResults.has(id))
      : idsToMatch.filter((id) => !out[id]);
    if (gapIds.length > 0) {
      found += await gapFillSpecies(gapIds, catalogById, out);
    }
  }
} else {
  console.log(
    `Sequential fetch for ${targetIds.length} species${xcKey ? " (Commons + Xeno-canto)" : " (Commons)"}…`,
  );

  for (const id of targetIds) {
    if (out[id] && !args.includes("--refresh")) {
      skipped += 1;
      continue;
    }

    const scientific = catalogById.get(id)?.scientific_name;
    if (!scientific) continue;

    try {
      const call = await fetchCallSequential(scientific);
      if (call) {
        out[id] = call;
        found += 1;
        console.log(id, "ok", call.callType ?? "audio");
      } else {
        missing += 1;
        if (!out[id]) delete out[id];
        console.log(id, "MISSING");
      }
    } catch (error) {
      missing += 1;
      console.log(id, "ERROR", error instanceof Error ? error.message : error);
    }

    await sleep(REQUEST_GAP_MS);
  }
}

fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

const total = Object.keys(out).length;
const stillMissing = catalog.length - total;
console.log(
  `Wrote ${outPath} (${total}/${catalog.length} species, ${found} new this run, ~${stillMissing} without commercial-safe calls, ${skipped} skipped)`,
);
