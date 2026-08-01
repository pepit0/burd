# Photo taxonomy (English names)

Photo ID uses the birder **iNaturalist 2021** checkpoint (~10,000 classes). English common names are resolved offline from bundled taxonomy data — not at runtime from external APIs.

## Data files

| File | Purpose |
|------|---------|
| `data/photo-catalog.json` | Full catalog entries (scientific name, common name, family, class index, kingdom) |
| `data/photo-taxonomy-index.json` | Compact `scientific name → English name` lookup for the app |
| `data/scientific-common.json` | Same map for client + server fallback in `label_utils.py` |
| `data/bird-catalog.json` | Aves-only subset (~1,500 species) for bird-specific tooling |
| `server/data/inat21-mapping.json` | Class index → common name (primary server path) |

Sound ID is unchanged and continues to use `data/sound-taxonomy-index.json` (Perch birds only).

## Rebuild commands

Requires server Python venv with `birder` installed.

```bash
# 1. Regenerate from iNat21 model labels + inat21-mapping
npm run generate-photo-taxonomy

# 2. Backfill gaps from GBIF English vernacular names (optional)
npm run backfill-photo-vernaculars
```

Legacy bird-only catalog:

```bash
npm run generate-bird-catalog
```

## Data sources and commercial use

- **iNat21 common names** — via birder `inat21-mapping.json` (verify iNat21 / model terms before commercial launch; see `server/inference/licenses.py`).
- **GBIF vernacular names** — CC0 / CC BY occurrence ecosystem; backfill script uses GBIF Species API for English names where iNat mapping is missing.
- **Not used** — eBird, iNaturalist CC BY-NC exports, or AviList (photo path).

Suggested attribution (in-app credits):

> Species common names include data from the birder iNaturalist 2021 mapping and GBIF.org vernacular names (CC0 / CC BY 4.0 where applicable).

## Known limitations

- **Regional GBIF priors** remain bird-only (`classKey=212` in prior build scripts). Geo/season re-ranking for mammals, insects, and plants still relies primarily on model confidence, not occurrence frequency.
- **~94 taxa** may still display title-cased scientific names if neither iNat nor GBIF returned an English vernacular.
- **Taxonomy** follows iNat21 species limits, not AviList or other checklists.

## Runtime flow

1. Server parses model class → `(common, scientific)` via `inat21-mapping` or `scientific-common.json`.
2. Client `enrichPrediction()` in `lib/predictionLabels.ts` resolves names via `lib/photoTaxonomy.ts` when needed.
3. `isInCatalog()` in `lib/taxonomy.ts` treats all photo-taxonomy species as catalog members for regional display thresholds.

## Species reference photos

Thumbnails (Live Photo ID banner, field guide, species detail) resolve via `lib/speciesImages.ts`:

| File | Purpose |
|------|---------|
| `data/species-image-urls.json` | Baked iNaturalist default photos keyed by photo-catalog id |
| `lib/photoCatalog.ts` | Derives `genus-epithet` catalog id from scientific name |
| `scripts/fetch-species-images.mjs` | Fetches photos from iNat API into the JSON bake file |

**Lookup order:** baked JSON (commercial licenses only) → live iNat API `default_photo` → woodpecker placeholder.

The bake script filters to CC0 / CC-BY (not NC). Runtime fetch accepts any iNat default photo so the field guide fills in as you scroll.

**Cache keys** use catalog id when known, otherwise `sci:{normalized binomial}` so non-bird detections no longer collide on a shared fallback id.

### Rebuild species images

```bash
# Full photo catalog (~10k species, ~35+ minutes at 200ms/species)
npm run fetch-species-images

# Birds only or partial bake while developing
node scripts/fetch-species-images.mjs --birds-only
node scripts/fetch-species-images.mjs --limit 200
node scripts/fetch-species-images.mjs --limit 50 --refresh
```

Skip already-baked ids on re-runs unless `--refresh` is passed. Runtime fetch fills gaps for species not yet in the JSON file.

## Species reference calls (field guide audio)

Reference bird calls on species detail and live sound ID use `lib/speciesCalls.ts` + `components/SpeciesCallPlayer.tsx`.

| File | Purpose |
|------|---------|
| `data/species-calls.json` | Baked call metadata keyed by catalog id |
| `scripts/fetch-species-calls.mjs` | Fetches commercial-safe recordings from Wikimedia Commons (Xeno-canto uploads) |

**License filter:** CC0, CC BY, and CC BY-SA only — **no NC or ND**. Each entry stores recordist, license, and a Wikimedia Commons source link for attribution.

Optional fallback when `XENO_CANTO_API_KEY` is set: script also queries Xeno-canto API v3 for CC-BY / CC0 / CC-BY-SA recordings.

### Rebuild species calls

```bash
# Fast path: bulk scan + automatic gap fill for missing species
npm run fetch-species-calls

# Only fetch species still missing from the JSON bake
node scripts/fetch-species-calls.mjs --missing-only

# Skip per-species gap fill (bulk only)
node scripts/fetch-species-calls.mjs --no-gap-fill

# Slow per-species search (legacy)
node scripts/fetch-species-calls.mjs --sequential --limit 200

# Targeted
node scripts/fetch-species-calls.mjs --sequential --ids turdus-migratorius,cardinalis-cardinalis
node scripts/fetch-species-calls.mjs --refresh
```

Suggested attribution (in-app credits):

> Reference bird calls from Wikimedia Commons (Creative Commons). Many recordings were contributed via Xeno-canto.
