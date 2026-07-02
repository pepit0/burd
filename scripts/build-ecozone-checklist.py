"""Build Merlin-style ecozone species checklists from GBIF (CC0 / CC BY only).

Uses sound-taxonomy.json (~14k Perch classes) instead of photo catalog.

Run from repo root:
  node scripts/run-python.mjs scripts/build-ecozone-checklist.py
  node scripts/run-python.mjs scripts/build-ecozone-checklist.py --zones canadian_prairies,pacific_nw
  node scripts/run-python.mjs scripts/build-ecozone-checklist.py --zones mexico_north --max-records 600
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "regional-priors"
ECOZONES_PATH = ROOT / "data" / "ecozones.json"
SOUND_TAXONOMY_PATH = ROOT / "data" / "sound-taxonomy.json"
CATALOG_PATH = ROOT / "data" / "bird-catalog.json"
OUTPUT_PATH = DATA_DIR / "ecozone-checklist.json"

ALLOWED_LICENSES = ("CC0_1_0", "CC_BY_4_0")
BINOMIAL_RE = re.compile(r"^[A-Za-z-]+ [A-Za-z-]+$")
TOP_SPECIES_PER_ZONE_MONTH = 250


def normalize_scientific(name: str) -> str | None:
    text = name.strip().lower().replace("_", " ")
    parts = text.split()
    if len(parts) < 2:
        return None
    candidate = f"{parts[0]} {parts[1]}"
    return candidate if BINOMIAL_RE.match(candidate) else None


def load_sound_taxonomy() -> set[str]:
    if SOUND_TAXONOMY_PATH.is_file():
        payload = json.loads(SOUND_TAXONOMY_PATH.read_text(encoding="utf-8"))
        names: set[str] = set()
        for row in payload.get("species", []):
            key = normalize_scientific(row.get("scientific_name") or "")
            if key:
                names.add(key)
        if names:
            return names

    # Fallback until sound taxonomy is generated.
    return load_catalog()


def load_catalog() -> set[str]:
    rows = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    names: set[str] = set()
    for row in rows:
        key = normalize_scientific(row.get("scientific_name") or "")
        if key:
            names.add(key)
    return names


def load_ecozones() -> list[dict]:
    payload = json.loads(ECOZONES_PATH.read_text(encoding="utf-8"))
    return payload["zones"]


def fetch_gbif_page(
    offset: int,
    limit: int,
    bbox: dict[str, float],
    license_code: str,
    month: int | None,
) -> list[dict]:
    if offset + limit > 100_000:
        return []

    params: list[tuple[str, str | int]] = [
        ("classKey", 212),
        ("hasCoordinate", "true"),
        ("hasGeospatialIssue", "false"),
        ("license", license_code),
        ("limit", limit),
        ("offset", offset),
        ("decimalLatitude", f"{bbox['minLat']},{bbox['maxLat']}"),
        ("decimalLongitude", f"{bbox['minLng']},{bbox['maxLng']}"),
    ]
    if month is not None:
        params.append(("month", month))

    url = "https://api.gbif.org/v1/occurrence/search?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "BurdEcozoneChecklist/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload.get("results", [])


def fetch_zone_month(
    zone: dict,
    month: int,
    catalog: set[str],
    max_records: int,
) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    bbox = {
        "minLat": zone["minLat"],
        "maxLat": zone["maxLat"],
        "minLng": zone["minLng"],
        "maxLng": zone["maxLng"],
    }
    limit = 300
    fetched = 0

    for license_code in ALLOWED_LICENSES:
        if fetched >= max_records:
            break
        offset = 0
        while fetched < max_records:
            batch = fetch_gbif_page(offset, limit, bbox, license_code, month)
            if not batch:
                break
            for row in batch:
                if fetched >= max_records:
                    break
                species = normalize_scientific(row.get("species") or "")
                if not species or species not in catalog:
                    continue
                counts[species] += 1
                fetched += 1
            offset += limit
            if len(batch) < limit or offset >= 100_000:
                break

    return counts


def top_species(counts: dict[str, int], limit: int) -> list[str]:
    ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    return [species for species, _ in ranked[:limit]]


def build_checklist(
    zones: list[dict],
    catalog: set[str],
    max_records: int,
    merge_existing: dict | None,
) -> dict:
    output: dict = {"version": 1, "zones": {}}
    if merge_existing:
        output["zones"] = dict(merge_existing.get("zones", {}))

    per_month_budget = max(50, max_records // 12)

    for zone in zones:
        zone_id = zone["id"]
        print(f"Zone {zone_id} ({zone['label']})...")
        zone_data: dict = {"label": zone["label"], "months": {}}
        all_counts: dict[str, int] = defaultdict(int)

        for month in range(1, 13):
            print(f"  month {month}...", flush=True)
            counts = fetch_zone_month(zone, month, catalog, per_month_budget)
            species_list = top_species(counts, TOP_SPECIES_PER_ZONE_MONTH)
            if species_list:
                zone_data["months"][str(month)] = species_list
            for species, count in counts.items():
                all_counts[species] += count

        zone_data["months"]["all"] = top_species(all_counts, TOP_SPECIES_PER_ZONE_MONTH * 2)
        output["zones"][zone_id] = zone_data
        print(f"  -> {len(zone_data['months']['all'])} species (all-month union)")

    output["built_at"] = datetime.now(timezone.utc).isoformat()
    output["source"] = "gbif-api-ecozones"
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Build ecozone species checklists")
    parser.add_argument(
        "--zones",
        default="",
        help="Comma-separated zone ids (default: all)",
    )
    parser.add_argument(
        "--max-records",
        type=int,
        default=600,
        help="Max GBIF records per zone per month",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace checklist entirely instead of merging zones",
    )
    args = parser.parse_args()

    catalog = load_sound_taxonomy()
    zones = load_ecozones()
    if args.zones.strip():
        wanted = {z.strip() for z in args.zones.split(",") if z.strip()}
        zones = [z for z in zones if z["id"] in wanted]

    merge_existing = None
    if not args.replace and OUTPUT_PATH.is_file():
        merge_existing = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    checklist = build_checklist(zones, catalog, args.max_records, merge_existing)
    OUTPUT_PATH.write_text(json.dumps(checklist, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
