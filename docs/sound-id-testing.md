# Sound ID testing matrix

Manual verification gate before calling NA sound ID "done". Each test uses a 15s live recording at representative coordinates.

## Pass criteria

- Server logs show geo-ranked top-5 (not raw Perch confidence order).
- Live UI list matches expected local species after regional gates.
- Stop/review screen shows up to 5 session species ranked by hit count, then geo score.
- Vagrant species below 35% confidence are suppressed unless on checklist/GBIF expected list.

## Rebuild commands

```bash
# 1. Generate full Perch sound taxonomy (~14k)
node scripts/run-python.mjs scripts/generate-sound-taxonomy.py

# 2. Rebuild NA ecozone checklists (long-running — run zone-by-zone)
node scripts/run-python.mjs scripts/build-ecozone-checklist.py --zones mexico_north --max-records 600
node scripts/run-python.mjs scripts/build-ecozone-checklist.py --max-records 600

# 3. NA GBIF cell priors (836 cells in production bundle)
node scripts/run-python.mjs scripts/build-regional-priors.py --region na --max-records 50000 --month-stratify

# 4. Global priors (2° grid, sound-taxonomy filtered)
node scripts/run-python.mjs scripts/build-global-priors.py --max-records 50000 --month-stratify

# 5. Client/server parity audit
node scripts/run-python.mjs scripts/audit-regional-parity.py
```

Fixture builds for dev:

```bash
node scripts/run-python.mjs scripts/build-regional-priors.py --region na --sample
node scripts/run-python.mjs scripts/build-global-priors.py --sample
```

## Automated smoke tests

```bash
cd server && .venv/Scripts/python.exe -m pytest tests/test_regional_sound.py -v
```

Expected: Edmonton Robin @ 12% ranks above / suppresses Blackbird @ 14%.

## 13-zone test matrix

| Ecozone | Sample coords | Test focus |
|---------|---------------|------------|
| alaska | 64.2, -149.5 | Boreal, sparse cells |
| pacific_nw | 47.6, -122.3 | Pacific wren, varied thrush |
| canadian_prairies | 53.5, -113.5 | Robin vs blackbird, corvids |
| rockies | 43.5, -110.8 | Elevation overlap |
| california | 37.8, -122.4 | High diversity |
| southwest_us | 35.1, -106.6 | Sparse GBIF cells |
| texas | 29.8, -95.4 | Mexico border species |
| southeast_us | 33.7, -84.4 | High diversity overlap |
| florida | 25.8, -80.2 | Subtropical |
| northeast_us | 42.4, -71.1 | Mixed forest |
| midwest_us | 41.9, -87.6 | Backyard common species |
| mexico_north | 28.6, -106.1 | Checklist coverage (new zone) |
| mexico_south | 19.4, -99.1 | Tropical overlap |

## Priority smoke zones (run after Phase 1+2)

1. **canadian_prairies** (Edmonton) — American Robin expected; Eurasian Blackbird suppressed at 14%.
2. **pacific_nw** (Seattle) — Pacific Wren / Varied Thrush over eastern vagrants.
3. **southeast_us** (Atlanta) — high diversity; verify top-5 stability across chunks.

## Server restart

After server-side changes, restart inference and point the app at your LAN IP:

```bash
cd server && .venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Set `EXPO_PUBLIC_INFERENCE_URL=http://<your-ip>:8000` in `.env`.

## Debug mode (Blue Jay / Perch diagnosis)

Turn on **both** flags, restart server + reload Expo, then record a Blue Jay clip.

**Server** (`server/.env`):

```env
AUDIO_DEBUG=true
```

**App** (root `.env`):

```env
EXPO_PUBLIC_SOUND_DEBUG=true
```

### What to watch

**Server terminal** (each chunk):

| Log line | Meaning |
|----------|---------|
| `Perch top-5 (mean):` | Always logged — raw model output |
| `Sound debug raw Perch:` | Taxonomy-filtered preds before geo |
| `Sound debug watch: cyanocitta cristata mean_prob=…` | **Key line** — did Perch score Blue Jay on this chunk? |
| `Sound debug final:` | What the API returns after geo pipeline |

**Expo / Metro console**:

```
[SoundID:chunk] server returned N preds → client M after rank
```

### How to interpret

- **`cyanocitta cristata mean_prob` ≥ 0.03** on jeer chunks → Perch hears Jay; geo/display may be the bottleneck.
- **Jay never in raw Perch / watch lines** → model limit on that call type; geo cannot fix it.
- **Jay in raw Perch but missing from `Sound debug final`** → filtering/ranking issue (paste those lines).

Do **not** set `INFERENCE_MOCK=true` — you need the real Perch model loaded.
