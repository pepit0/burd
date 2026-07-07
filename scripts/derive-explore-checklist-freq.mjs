#!/usr/bin/env node
/**
 * Derive per-month explore frequency maps from existing ecozone checklist lists.
 * List order approximates GBIF rank from the original build. Safe to re-run.
 *
 *   node scripts/derive-explore-checklist-freq.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKLIST_PATH = join(ROOT, "data/regional-priors/ecozone-checklist.json");

const PEAK_FREQ = 0.18;
const FLOOR_FREQ = 0.008;

function rankFrequency(rank, total) {
  if (total <= 0) return 0;
  if (total === 1) return PEAK_FREQ;
  const t = 1 - rank / (total - 1);
  return FLOOR_FREQ + t * (PEAK_FREQ - FLOOR_FREQ);
}

function freqFromList(speciesList) {
  const out = {};
  const total = speciesList.length;
  speciesList.forEach((species, index) => {
    out[species] = Number(rankFrequency(index, total).toFixed(6));
  });
  return out;
}

function averageFreqMaps(maps) {
  const sums = {};
  const counts = {};
  for (const freqMap of maps) {
    for (const [species, freq] of Object.entries(freqMap)) {
      sums[species] = (sums[species] ?? 0) + freq;
      counts[species] = (counts[species] ?? 0) + 1;
    }
  }
  const out = {};
  for (const species of Object.keys(sums)) {
    out[species] = Number((sums[species] / counts[species]).toFixed(6));
  }
  return out;
}

const checklist = JSON.parse(readFileSync(CHECKLIST_PATH, "utf8"));

for (const zone of Object.values(checklist.zones ?? {})) {
  const months = zone.months ?? {};
  const monthFreqMaps = [];

  for (let month = 1; month <= 12; month++) {
    const key = String(month);
    const list = months[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    const freqMap = freqFromList(list);
    months[`${month}_freq`] = freqMap;
    monthFreqMaps.push(freqMap);
  }

  const allList = months.all;
  if (Array.isArray(allList) && allList.length > 0) {
    const fromMonths = averageFreqMaps(monthFreqMaps);
    const allRanked = freqFromList(allList);
    const allFreq = { ...allRanked };
    for (const [species, freq] of Object.entries(fromMonths)) {
      if (allFreq[species] == null || freq > allFreq[species]) {
        allFreq[species] = freq;
      }
    }
    months.all_freq = allFreq;
  }
}

checklist.explore_freq_derived_at = new Date().toISOString();
writeFileSync(CHECKLIST_PATH, JSON.stringify(checklist));
console.log(`Wrote explore frequency maps to ${CHECKLIST_PATH}`);
