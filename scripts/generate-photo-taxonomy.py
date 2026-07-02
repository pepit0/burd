"""Generate full iNat21 photo taxonomy (~10k classes) for Photo ID English names.

Run from repo root:
  node scripts/run-python.mjs scripts/generate-photo-taxonomy.py
  node scripts/run-python.mjs scripts/generate-photo-taxonomy.py --birds-only
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "server"
DATA_DIR = ROOT / "data"
SERVER_DATA = SERVER / "data"

sys.path.insert(0, str(SERVER))

import birder  # noqa: E402

WEIGHTS = "rope_vit_reg4_b14_capi-inat21"
MAPPING_PATH = SERVER_DATA / "inat21-mapping.json"
PHOTO_CATALOG_PATH = DATA_DIR / "photo-catalog.json"
PHOTO_INDEX_PATH = DATA_DIR / "photo-taxonomy-index.json"
BIRD_CATALOG_PATH = DATA_DIR / "bird-catalog.json"
SCIENTIFIC_COMMON_PATHS = (
    DATA_DIR / "scientific-common.json",
    SERVER_DATA / "scientific-common.json",
)


def title_case_scientific(scientific: str) -> str:
    return " ".join(part.capitalize() for part in scientific.split())


def parse_label(label: str, class_index: int, mapping: dict[str, str]) -> dict | None:
    """Parse iNat21 label into catalog entry."""
    parts = label.split("_")
    if len(parts) < 4 or not parts[0].isdigit():
        return None

    genus, species_epithet = parts[-2], parts[-1]
    scientific_name = f"{genus} {species_epithet}"
    catalog_id = f"{genus}-{species_epithet}".lower()
    common_name = mapping.get(str(class_index)) or title_case_scientific(scientific_name)
    family = parts[-3]
    kingdom = parts[1] if len(parts) > 1 else None

    entry: dict[str, str | int] = {
        "id": catalog_id,
        "species": common_name,
        "scientific_name": scientific_name,
        "family": family,
        "class_index": class_index,
    }
    if kingdom:
        entry["kingdom"] = kingdom
    return entry


def write_json(path: Path, payload: object, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    else:
        text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build iNat21 photo taxonomy JSON")
    parser.add_argument(
        "--birds-only",
        action="store_true",
        help="Emit bird-catalog.json only (legacy generate-bird-catalog behavior)",
    )
    args = parser.parse_args()

    mapping: dict[str, str] = {}
    if MAPPING_PATH.is_file():
        mapping = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))

    _, model_info, _ = birder.load_pretrained_model_and_transform(
        WEIGHTS,
        inference=True,
        progress_bar=True,
    )
    idx_to_label = {v: k for k, v in model_info.class_to_idx.items()}

    entries: list[dict[str, str | int]] = []
    for idx, label in sorted(idx_to_label.items()):
        if args.birds_only and "_Aves_" not in label:
            continue
        entry = parse_label(label, idx, mapping)
        if entry:
            entries.append(entry)

    entries.sort(key=lambda row: str(row["species"]).lower())

    if args.birds_only:
        write_json(BIRD_CATALOG_PATH, entries)
        print(f"Wrote {len(entries)} bird species to {BIRD_CATALOG_PATH}")
        common_map = {
            str(entry["scientific_name"]).strip().lower(): str(entry["species"])
            for entry in entries
        }
        for path in SCIENTIFIC_COMMON_PATHS:
            write_json(path, common_map, compact=True)
            print(f"Wrote {len(common_map)} scientific names to {path}")
        return

    write_json(PHOTO_CATALOG_PATH, entries)
    print(f"Wrote {len(entries)} species to {PHOTO_CATALOG_PATH}")

    index: dict[str, str] = {}
    for entry in entries:
        key = str(entry["scientific_name"]).strip().lower()
        index[key] = str(entry["species"])
    write_json(PHOTO_INDEX_PATH, index, compact=True)
    print(f"Wrote {len(index)} entries to {PHOTO_INDEX_PATH}")

    common_map = dict(index)
    for path in SCIENTIFIC_COMMON_PATHS:
        write_json(path, common_map, compact=True)
        print(f"Wrote {len(common_map)} scientific names to {path}")

    bird_entries = []
    for entry in entries:
        label = idx_to_label.get(int(entry["class_index"]), "")
        if "_Aves_" in label:
            bird_entries.append(entry)

    write_json(BIRD_CATALOG_PATH, bird_entries)
    print(f"Wrote {len(bird_entries)} bird species to {BIRD_CATALOG_PATH}")


if __name__ == "__main__":
    main()
