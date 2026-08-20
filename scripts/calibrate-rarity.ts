/**
 * Spot-check regional rarity scoring before shipping UI changes.
 *
 *   npx tsx scripts/calibrate-rarity.ts
 */
import { lookupRegionalRarity } from "../lib/rarity";

interface Case {
  label: string;
  species: string;
  scientific: string;
  lat: number;
  lng: number;
  month: number;
  expect: Array<"common" | "uncommon" | "rare">;
}

const CASES: Case[] = [
  {
    label: "NYC American Robin (June)",
    species: "American Robin",
    scientific: "Turdus migratorius",
    lat: 40.7128,
    lng: -74.006,
    month: 6,
    expect: ["common", "uncommon"],
  },
  {
    label: "NYC Northern Cardinal (June)",
    species: "Northern Cardinal",
    scientific: "Cardinalis cardinalis",
    lat: 40.7128,
    lng: -74.006,
    month: 6,
    expect: ["common"],
  },
  {
    label: "NYC Painted Bunting (June)",
    species: "Painted Bunting",
    scientific: "Passerina ciris",
    lat: 40.7128,
    lng: -74.006,
    month: 6,
    expect: ["rare", "uncommon"],
  },
  {
    label: "Chicago American Robin (May)",
    species: "American Robin",
    scientific: "Turdus migratorius",
    lat: 41.8781,
    lng: -87.6298,
    month: 5,
    expect: ["common", "uncommon"],
  },
  {
    label: "Seattle Bald Eagle",
    species: "Bald Eagle",
    scientific: "Haliaeetus leucocephalus",
    lat: 47.6062,
    lng: -122.3321,
    month: 6,
    expect: ["uncommon", "rare"],
  },
  {
    label: "Edmonton Snowy Owl (July)",
    species: "Snowy Owl",
    scientific: "Bubo scandiacus",
    lat: 53.5461,
    lng: -113.4938,
    month: 7,
    expect: ["rare", "uncommon"],
  },
  {
    label: "Santa Monica Western Gull (July)",
    species: "Western Gull",
    scientific: "Larus occidentalis",
    lat: 34.0095,
    lng: -118.4975,
    month: 7,
    expect: ["common", "uncommon"],
  },
  {
    label: "Santa Monica Ring-billed Gull (July)",
    species: "Ring-billed Gull",
    scientific: "Larus delawarensis",
    lat: 34.0095,
    lng: -118.4975,
    month: 7,
    expect: ["common", "uncommon"],
  },
  {
    label: "Coney Island Herring Gull (July)",
    species: "Herring Gull",
    scientific: "Larus argentatus",
    lat: 40.575,
    lng: -73.97,
    month: 7,
    expect: ["common", "uncommon"],
  },
  {
    label: "Miami Beach Laughing Gull (July)",
    species: "Laughing Gull",
    scientific: "Leucophaeus atricilla",
    lat: 25.7907,
    lng: -80.13,
    month: 7,
    expect: ["common", "uncommon"],
  },
];

let failed = 0;

for (const test of CASES) {
  const observedAt = new Date(Date.UTC(2026, test.month - 1, 15)).toISOString();
  const rarity = lookupRegionalRarity({
    species: test.species,
    scientificName: test.scientific,
    lat: test.lat,
    lng: test.lng,
    observedAt,
  });

  const ok = test.expect.includes(rarity);
  if (!ok) failed += 1;

  console.log(
    `${ok ? "PASS" : "FAIL"}  ${test.label}: ${rarity} (expected one of ${test.expect.join("|")})`,
  );
}

if (failed > 0) {
  console.error(`\n${failed}/${CASES.length} calibration cases failed.`);
  process.exit(1);
}

console.log(`\nAll ${CASES.length} calibration cases passed.`);
