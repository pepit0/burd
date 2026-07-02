# Regional frequency priors

Burd uses offline geo/season species frequency priors to filter and re-rank
ML predictions and to estimate regional rarity.

## Data sources (commercial use)

- **GBIF** occurrence records under **CC0** and **CC BY 4.0** only
- **Burd community** sighting aggregates (grid cells, no raw coordinates exported)

eBird, iNaturalist CC BY-NC, and Map of Life free tiers are **not** included.

## Merlin-style sound checklist

Sound ID uses a **regional checklist** (like Merlin):

1. **GBIF cell priors** — occurrence frequency per 1° cell × month
2. **Ecozone checklist fallback** — `data/regional-priors/ecozone-checklist.json`
3. **Vision catalog constraint** — only ~1,500 iNat species (same as photo ID)

Perch returns top catalog candidates; the server re-ranks by checklist before responding.

### Patch sparse regions (no full re-download)

Canadian Prairies / Western Canada:

```bash
npm run patch:regional-priors:prairies
npm run build:ecozone-checklist:prairies
```

Merge into existing bundle:

```bash
node scripts/run-python.mjs scripts/build-regional-priors.py --region na --merge --month-stratify --max-records 12000 --bbox 49,60,-115,-95
```

Build all ecozone checklists (one-time, ~15 zones):

```bash
npm run build:ecozone-checklist
```

## Rebuild bundles

Sample fixture (development):

```bash
npm run build:regional-priors:sample
```

Full GBIF API pull (NA + global):

```bash
npm run build:regional-priors
```

Outputs:

- `data/regional-priors/na.sqlite` + `na-priors.json`
- `data/regional-priors/global.sqlite` + `global-priors.json`
- Copies sqlite to `server/data/regional-priors/` for inference server

## Grid scheme

| Region | Grid | Bbox |
|--------|------|------|
| North America | 1° lat/lng | lat 15–72, lng -170 to -50 |
| Global | 2° lat/lng | worldwide |

Cell id example: `40_-83` (lat band 40, lng band -83).

## Community merge (optional)

After applying migration `0018_regional_frequency.sql`, community counts
accumulate on each sighting insert. To bake counts into offline bundles:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run merge:regional-priors
```

## Runtime

- Client: `lib/regionalFrequency.ts` loads JSON bundles
- Server: `server/inference/regional.py` reads sqlite
- Providers: `lib/regionalProviders.ts` (GBIF + community + licensed stub)

Pass `latitude`, `longitude`, and `observed_at` with identify requests for
server-side filtering.
