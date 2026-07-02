"""Build regional species frequency priors from GBIF (CC0 / CC BY only).

Run from repo root:
  server/.venv/Scripts/python.exe scripts/build-regional-priors.py --sample
  server/.venv/Scripts/python.exe scripts/build-regional-priors.py --region na
  server/.venv/Scripts/python.exe scripts/build-regional-priors.py --region global

Commercial use: only CC0_1_0 and CC_BY_4_0 occurrence records are included.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sqlite3
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "regional-priors"
SERVER_DATA = ROOT / "server" / "data" / "regional-priors"

NA_BBOX = {"minLat": 15, "maxLat": 72, "minLng": -170, "maxLng": -50}
NA_GRID = 1
GLOBAL_GRID = 2
TOP_SPECIES_PER_CELL_MONTH = 300
ALLOWED_LICENSES = ("CC0_1_0", "CC_BY_4_0")

BINOMIAL_RE = re.compile(r"^[A-Za-z-]+ [A-Za-z-]+$")


def cell_id(lat: float, lng: float, grid_deg: float) -> str:
    lat_band = math.floor(lat / grid_deg) * grid_deg
    lng_band = math.floor(lng / grid_deg) * grid_deg
    return f"{int(lat_band)}_{int(lng_band)}"


def normalize_scientific(name: str) -> str | None:
    text = name.strip().lower().replace("_", " ")
    parts = text.split()
    if len(parts) < 2:
        return None
    candidate = f"{parts[0]} {parts[1]}"
    return candidate if BINOMIAL_RE.match(candidate) else None


def parse_month(event_date: str) -> int | None:
    if not event_date or len(event_date) < 7:
        return None
    try:
        month = int(event_date[5:7])
        if 1 <= month <= 12:
            return month
    except ValueError:
        return None
    return None


def init_db(path: Path, *, merge: bool = False) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and merge:
        conn = sqlite3.connect(path)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cell_priors (
                cell_id TEXT NOT NULL,
                month INTEGER NOT NULL,
                scientific_name TEXT NOT NULL,
                frequency REAL NOT NULL,
                raw_count INTEGER NOT NULL,
                PRIMARY KEY (cell_id, month, scientific_name)
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_cell_month ON cell_priors (cell_id, month)"
        )
        return conn

    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    conn.execute(
        """
        CREATE TABLE cell_priors (
            cell_id TEXT NOT NULL,
            month INTEGER NOT NULL,
            scientific_name TEXT NOT NULL,
            frequency REAL NOT NULL,
            raw_count INTEGER NOT NULL,
            PRIMARY KEY (cell_id, month, scientific_name)
        )
        """
    )
    conn.execute(
        "CREATE INDEX idx_cell_month ON cell_priors (cell_id, month)"
    )
    return conn


def load_existing_counts(conn: sqlite3.Connection) -> dict[tuple[str, int, str], int]:
    counts: dict[tuple[str, int, str], int] = defaultdict(int)
    rows = conn.execute(
        "SELECT cell_id, month, scientific_name, raw_count FROM cell_priors"
    ).fetchall()
    for cell, month, species, raw in rows:
        counts[(cell, int(month), species)] += int(raw)
    return counts


def export_cells_from_db(conn: sqlite3.Connection) -> dict:
    export: dict[str, dict[str, dict[str, dict[str, float | int]]]] = {}
    rows = conn.execute(
        "SELECT cell_id, month, scientific_name, frequency, raw_count FROM cell_priors"
    ).fetchall()
    for cell, month, species, freq, raw in rows:
        export.setdefault(cell, {}).setdefault(str(month), {})[species] = {
            "f": round(float(freq), 6),
            "c": int(raw),
        }
    return export


def write_priors(
    conn: sqlite3.Connection,
    counts: dict[tuple[str, int, str], int],
    grid_label: str,
) -> dict:
    cell_month_totals: dict[tuple[str, int], int] = defaultdict(int)
    for (cell, month, _species), count in counts.items():
        cell_month_totals[(cell, month)] += count

    rows: list[tuple[str, int, str, float, int]] = []
    grouped: dict[tuple[str, int], list[tuple[str, int]]] = defaultdict(list)
    for (cell, month, species), count in counts.items():
        grouped[(cell, month)].append((species, count))

    for (cell, month), species_counts in grouped.items():
        total = cell_month_totals[(cell, month)]
        if total <= 0:
            continue
        species_counts.sort(key=lambda item: item[1], reverse=True)
        for species, count in species_counts[:TOP_SPECIES_PER_CELL_MONTH]:
            freq = count / total
            rows.append((cell, month, species, freq, count))

    conn.executemany(
        "INSERT INTO cell_priors VALUES (?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()

    export: dict[str, dict[str, dict[str, dict[str, float | int]]]] = {}
    for cell, month, species, freq, raw in rows:
        export.setdefault(cell, {}).setdefault(str(month), {})[species] = {
            "f": round(freq, 6),
            "c": raw,
        }

    return export


def export_json(path: Path, cells: dict) -> None:
    path.write_text(json.dumps({"cells": cells}, separators=(",", ":")), encoding="utf-8")


def write_manifest(
    path: Path,
    *,
    region: str,
    grid_deg: int,
    source: str,
    cell_count: int,
    record_count: int,
) -> None:
    manifest = {
        "version": 1,
        "region": region,
        "grid_deg": grid_deg,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "licenses": list(ALLOWED_LICENSES),
        "attribution": [
            "Species occurrence frequencies derived from GBIF.org (CC0 and CC BY 4.0 records only).",
            "GBIF.org (YYYY). GBIF Occurrence Download. https://doi.org/10.15468/dl.placeholder",
            "Burd community sighting aggregates (when enabled).",
        ],
        "cell_count": cell_count,
        "record_count": record_count,
    }
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def sample_counts(region: str) -> dict[tuple[str, int, str], int]:
    """Fixture data for dev/testing — Ohio-ish June backyard birds."""
    counts: dict[tuple[str, int, str], int] = defaultdict(int)

    def add(cell: str, month: int, species: str, n: int) -> None:
        counts[(cell, month, species)] += n

    if region == "na":
        # Columbus, OH area (~40, -83), June
        for sp, n in [
            ("cyanocitta cristata", 420),
            ("turdus migratorius", 380),
            ("cardinalis cardinalis", 350),
            ("branta canadensis", 120),
            ("corvus brachyrhynchos", 200),
            ("melospiza melodia", 180),
            ("setophaga petechia", 160),
            ("agelaius phoeniceus", 140),
        ]:
            add("40_-83", 6, sp, n)
        add("40_-83", 6, "cyanochen cyanoptera", 1)
        add("40_-83", 1, "cyanocitta cristata", 80)
        add("40_-83", 1, "branta canadensis", 200)
        # Edmonton / Canadian Prairies
        add("53_-113", 6, "turdus migratorius", 420)
        add("53_-113", 6, "corvus brachyrhynchos", 300)
        add("53_-113", 6, "branta canadensis", 180)
        add("53_-113", 6, "poecile atricapillus", 200)
        add("53_-113", 6, "spinus tristis", 160)
        add("53_-113", 6, "setophaga petechia", 140)
        add("53_-113", 6, "colaptes auratus", 120)
        add("53_-113", 6, "buteo swainsoni", 90)
        add("53_-113", 1, "turdus migratorius", 60)
        add("53_-113", 1, "corvus brachyrhynchos", 80)
        # Seattle-ish
        add("47_-122", 6, "corvus brachyrhynchos", 300)
        add("47_-122", 6, "turdus migratorius", 150)
    else:
        # Western Europe + general global cells (sound-taxonomy species)
        for sp, n in [
            ("turdus merula", 500),
            ("erithacus rubecula", 320),
            ("parus major", 280),
            ("cyanistes caeruleus", 260),
            ("corvus corone", 180),
        ]:
            add("50_10", 6, sp, n)
        add("50_10", 6, "cyanocitta cristata", 2)
        add("48_2", 6, "turdus merula", 420)
        add("48_2", 6, "passer domesticus", 350)
        add("35_139", 6, "corvus macrorhynchos", 300)
        add("35_139", 6, "columba livia", 220)
        add("-1_36", 6, "bubo africanus", 120)
        add("-1_36", 6, "buphagus erythrorynchus", 90)
        add("0_0", 6, "corvus corax", 150)
        add("0_0", 6, "bubo bubo", 40)

    return counts


def fetch_gbif_page(
    offset: int,
    limit: int,
    bbox: dict[str, float] | None,
    license_code: str,
    month: int | None = None,
) -> list[dict]:
    if offset + limit > 100_000:
        return []

    params: list[tuple[str, str | int]] = [
        ("classKey", 212),  # Aves
        ("hasCoordinate", "true"),
        ("hasGeospatialIssue", "false"),
        ("license", license_code),
        ("limit", limit),
        ("offset", offset),
    ]
    if bbox:
        params.append(("decimalLatitude", f"{bbox['minLat']},{bbox['maxLat']}"))
        params.append(("decimalLongitude", f"{bbox['minLng']},{bbox['maxLng']}"))
    if month is not None:
        params.append(("month", month))

    url = "https://api.gbif.org/v1/occurrence/search?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "BurdRegionalPriors/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"GBIF API error {exc.code} for license={license_code}: {body[:500]}"
        ) from exc
    return payload.get("results", [])


def _load_sound_taxonomy_species() -> set[str]:
    path = ROOT / "data" / "sound-taxonomy-index.json"
    if not path.is_file():
        return set()
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {str(k).strip().lower() for k in raw.keys()}


def _ingest_batch(
    batch: list[dict],
    counts: dict[tuple[str, int, str], int],
    *,
    region: str,
    grid_deg: int,
    max_records: int,
    fetched: int,
    allowed_species: set[str] | None = None,
) -> int:
    for row in batch:
        if fetched >= max_records:
            break
        lat = row.get("decimalLatitude")
        lng = row.get("decimalLongitude")
        species = normalize_scientific(row.get("species") or "")
        month = parse_month(row.get("eventDate") or "")
        if lat is None or lng is None or not species or month is None:
            continue
        if allowed_species is not None and species not in allowed_species:
            continue
        if region == "na" and not (
            NA_BBOX["minLat"] <= lat <= NA_BBOX["maxLat"]
            and NA_BBOX["minLng"] <= lng <= NA_BBOX["maxLng"]
        ):
            continue
        cid = cell_id(float(lat), float(lng), grid_deg)
        counts[(cid, month, species)] += 1
        fetched += 1
    return fetched


def gbif_counts(
    region: str,
    max_records: int,
    bbox: dict[str, float] | None = None,
    *,
    month_stratify: bool = False,
    allowed_species: set[str] | None = None,
) -> dict[tuple[str, int, str], int]:
    if bbox is None:
        bbox = NA_BBOX if region == "na" else None
    grid_deg = NA_GRID if region == "na" else GLOBAL_GRID
    counts: dict[tuple[str, int, str], int] = defaultdict(int)
    limit = 300

    months = list(range(1, 13)) if month_stratify else [None]
    per_month_budget = max(100, max_records // len(months))

    for month in months:
        fetched = 0
        label = f"month {month}" if month else "all months"
        print(f"  {label} (budget {per_month_budget})...")
        for license_code in ALLOWED_LICENSES:
            if fetched >= per_month_budget:
                break
            print(f"    license {license_code}...")
            offset = 0
            page = 0
            while fetched < per_month_budget:
                batch = fetch_gbif_page(offset, limit, bbox, license_code, month)
                if not batch:
                    print(f"      done: no more results at offset {offset}")
                    break
                prev = fetched
                fetched = _ingest_batch(
                    batch,
                    counts,
                    region=region,
                    grid_deg=grid_deg,
                    max_records=per_month_budget,
                    fetched=fetched,
                    allowed_species=allowed_species,
                )
                page += 1
                offset += limit
                if page == 1 or page % 10 == 0:
                    print(
                        f"      page {page}: offset {offset}, "
                        f"ingested {fetched}/{per_month_budget} "
                        f"(+{fetched - prev} this page)",
                        flush=True,
                    )
                if len(batch) < limit or offset >= 100_000:
                    break

    return counts


def parse_bbox(raw: str | None) -> dict[str, float] | None:
    if not raw or not raw.strip():
        return None
    parts = [float(p.strip()) for p in raw.split(",")]
    if len(parts) != 4:
        raise ValueError("bbox must be minLat,maxLat,minLng,maxLng")
    return {
        "minLat": parts[0],
        "maxLat": parts[1],
        "minLng": parts[2],
        "maxLng": parts[3],
    }


def build_region(
    region: str,
    *,
    sample: bool,
    max_records: int,
    merge: bool = False,
    bbox: dict[str, float] | None = None,
    month_stratify: bool = False,
    sound_taxonomy_only: bool = False,
) -> None:
    grid_deg = NA_GRID if region == "na" else GLOBAL_GRID
    sqlite_path = DATA_DIR / f"{region}.sqlite"
    json_path = DATA_DIR / f"{region}-priors.json"

    conn = init_db(sqlite_path, merge=merge)
    existing = load_existing_counts(conn) if merge else {}

    allowed_species = _load_sound_taxonomy_species() if sound_taxonomy_only else None
    if sound_taxonomy_only and not allowed_species:
        raise SystemExit(
            "sound-taxonomy-index.json missing — run scripts/generate-sound-taxonomy.py first"
        )

    if sample:
        counts = sample_counts(region)
        if allowed_species:
            counts = {
                key: value
                for key, value in counts.items()
                if key[2] in allowed_species
            }
        source = "sample-fixture"
    else:
        print(f"Fetching up to {max_records} GBIF records for {region}...")
        new_counts = gbif_counts(
            region,
            max_records,
            bbox=bbox,
            month_stratify=month_stratify,
            allowed_species=allowed_species,
        )
        counts = existing
        for key, value in new_counts.items():
            counts[key] += value
        source = "gbif-api-merge" if merge else "gbif-api"

    if merge and not sample:
        conn.execute("DELETE FROM cell_priors")

    cells = write_priors(conn, counts, region)
    conn.close()

    export_json(json_path, cells)
    write_manifest(
        DATA_DIR / "manifest.json" if region == "na" else DATA_DIR / f"manifest-{region}.json",
        region=region,
        grid_deg=grid_deg,
        source=source,
        cell_count=len(cells),
        record_count=sum(counts.values()),
    )

    SERVER_DATA.mkdir(parents=True, exist_ok=True)
    server_sqlite = SERVER_DATA / f"{region}.sqlite"
    server_sqlite.write_bytes(sqlite_path.read_bytes())
    print(f"Wrote {sqlite_path} ({len(cells)} cells, {sum(counts.values())} records)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build regional frequency priors")
    parser.add_argument("--region", choices=("na", "global"), default="na")
    parser.add_argument("--sample", action="store_true", help="Use fixture data")
    parser.add_argument(
        "--max-records",
        type=int,
        default=50_000,
        help="Max GBIF records per region (API mode)",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Merge new records into existing na.sqlite instead of replacing",
    )
    parser.add_argument(
        "--bbox",
        default="",
        help="Optional minLat,maxLat,minLng,maxLng (limits GBIF fetch)",
    )
    parser.add_argument(
        "--month-stratify",
        action="store_true",
        help="Fetch evenly across months 1-12 (recommended for patches)",
    )
    parser.add_argument(
        "--sound-taxonomy-only",
        action="store_true",
        help="Only include species present in sound-taxonomy-index.json",
    )
    parser.add_argument("--all", action="store_true", help="Build na and global")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    bbox = parse_bbox(args.bbox) if args.bbox.strip() else None

    def run(region: str) -> None:
        build_region(
            region,
            sample=args.sample,
            max_records=args.max_records,
            merge=args.merge,
            bbox=bbox,
            month_stratify=args.month_stratify,
            sound_taxonomy_only=args.sound_taxonomy_only,
        )

    if args.all:
        run("na")
        run("global")
    else:
        run(args.region)


if __name__ == "__main__":
    main()
