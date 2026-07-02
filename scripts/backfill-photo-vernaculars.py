"""Backfill missing Photo ID English names from GBIF vernacular names (CC0 / CC BY).

Targets entries in photo-taxonomy-index.json where the common name equals the
title-cased scientific name (iNat mapping gap).

Run from repo root:
  node scripts/run-python.mjs scripts/backfill-photo-vernaculars.py
  node scripts/run-python.mjs scripts/backfill-photo-vernaculars.py --dry-run --limit 50
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SERVER_DATA = ROOT / "server" / "data"

PHOTO_CATALOG_PATH = DATA_DIR / "photo-catalog.json"
PHOTO_INDEX_PATH = DATA_DIR / "photo-taxonomy-index.json"
SCIENTIFIC_COMMON_PATHS = (
    DATA_DIR / "scientific-common.json",
    SERVER_DATA / "scientific-common.json",
)

BINOMIAL_RE = re.compile(r"^[a-z]+ [a-z][a-z-]+$")
USER_AGENT = "BurdPhotoTaxonomy/1.0"
REQUEST_DELAY_S = 0.12


def normalize_scientific(name: str) -> str:
    parts = name.strip().lower().replace("_", " ").split()
    if len(parts) < 2:
        return name.strip().lower()
    return f"{parts[0]} {parts[1]}"


def title_case_scientific(scientific: str) -> str:
    return " ".join(part.capitalize() for part in scientific.split())


def needs_backfill(scientific: str, common: str) -> bool:
    if not common or not scientific:
        return True
    if common.strip().lower() == scientific.strip().lower():
        return True
    if common == title_case_scientific(scientific):
        return True
    return False


def gbif_get(url: str) -> dict | list | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"  GBIF error {url}: {exc}", flush=True)
        return None


def match_species_key(scientific: str) -> int | None:
    payload = gbif_get(
        "https://api.gbif.org/v1/species/match?"
        + urllib.parse.urlencode({"name": scientific, "verbose": "true"})
    )
    if not isinstance(payload, dict):
        return None
    usage_key = payload.get("usageKey") or payload.get("speciesKey")
    if isinstance(usage_key, int) and payload.get("matchType") != "NONE":
        return usage_key
    return None


def fetch_english_vernacular(usage_key: int) -> str | None:
    payload = gbif_get(
        f"https://api.gbif.org/v1/species/{usage_key}/vernacularNames"
    )
    if not isinstance(payload, dict):
        return None
    results = payload.get("results", [])
    if not isinstance(results, list):
        return None

    english: list[dict] = []
    for row in results:
        if not isinstance(row, dict):
            continue
        lang = str(row.get("language", "")).lower()
        if lang not in {"en", "eng", ""}:
            continue
        name = str(row.get("vernacularName", "")).strip()
        if not name:
            continue
        english.append(row)

    if not english:
        return None

    preferred = [r for r in english if r.get("preferred")]
    pool = preferred if preferred else english
    pool.sort(key=lambda r: (not r.get("preferred"), len(str(r.get("vernacularName", "")))))
    return str(pool[0]["vernacularName"]).strip()


def load_index() -> dict[str, str]:
    if not PHOTO_INDEX_PATH.is_file():
        raise SystemExit(f"Missing {PHOTO_INDEX_PATH} — run generate-photo-taxonomy.py first")
    return json.loads(PHOTO_INDEX_PATH.read_text(encoding="utf-8"))


def write_json(path: Path, payload: object, *, compact: bool = False) -> None:
    if compact:
        text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    else:
        text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")


def sync_catalog(index: dict[str, str]) -> None:
    if not PHOTO_CATALOG_PATH.is_file():
        return
    catalog = json.loads(PHOTO_CATALOG_PATH.read_text(encoding="utf-8"))
    for entry in catalog:
        key = normalize_scientific(str(entry.get("scientific_name", "")))
        if key in index:
            entry["species"] = index[key]
    write_json(PHOTO_CATALOG_PATH, catalog)


def main() -> None:
    parser = argparse.ArgumentParser(description="GBIF vernacular backfill for photo taxonomy")
    parser.add_argument("--dry-run", action="store_true", help="Do not write files")
    parser.add_argument("--limit", type=int, default=0, help="Max species to query (0 = all gaps)")
    args = parser.parse_args()

    index = load_index()
    gaps = [
        key
        for key, common in index.items()
        if BINOMIAL_RE.match(key) and needs_backfill(key, common)
    ]
    gaps.sort()
    print(f"Photo taxonomy: {len(index)} species, {len(gaps)} need backfill")

    if args.limit > 0:
        gaps = gaps[: args.limit]

    filled = 0
    errors = 0
    for i, scientific in enumerate(gaps, start=1):
        if i % 25 == 1 or i == len(gaps):
            print(f"  [{i}/{len(gaps)}] {scientific}...", flush=True)

        usage_key = match_species_key(scientific)
        time.sleep(REQUEST_DELAY_S)
        if usage_key is None:
            errors += 1
            continue

        vernacular = fetch_english_vernacular(usage_key)
        time.sleep(REQUEST_DELAY_S)
        if not vernacular:
            errors += 1
            continue

        index[scientific] = vernacular
        filled += 1

    still_missing = sum(
        1 for key, common in index.items() if needs_backfill(key, common)
    )
    print(f"Filled {filled} names; {still_missing} still missing; {errors} lookup failures")

    if args.dry_run:
        print("Dry run — no files written")
        return

    write_json(PHOTO_INDEX_PATH, index, compact=True)
    for path in SCIENTIFIC_COMMON_PATHS:
        write_json(path, index, compact=True)
        print(f"Updated {path}")
    sync_catalog(index)
    print(f"Updated {PHOTO_CATALOG_PATH}")


if __name__ == "__main__":
    main()
