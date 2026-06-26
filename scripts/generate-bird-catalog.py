"""Generate data/bird-catalog.json from the birder iNat21 model (Aves only).

Run from repo root:
  server/.venv/Scripts/python.exe scripts/generate-bird-catalog.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "server"
sys.path.insert(0, str(SERVER))

import birder  # noqa: E402

WEIGHTS = "rope_vit_reg4_b14_capi-inat21"
MAPPING_PATH = SERVER / "data" / "inat21-mapping.json"
OUTPUT_PATH = ROOT / "data" / "bird-catalog.json"


def main() -> None:
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
    for idx, label in idx_to_label.items():
        if "_Aves_" not in label:
            continue

        parts = label.split("_")
        if len(parts) < 4:
            continue

        genus, species_epithet = parts[-2], parts[-1]
        scientific_name = f"{genus} {species_epithet}"
        catalog_id = f"{genus}-{species_epithet}".lower()
        common_name = mapping.get(str(idx), scientific_name)
        family = parts[-3]

        entries.append(
            {
                "id": catalog_id,
                "species": common_name,
                "scientific_name": scientific_name,
                "family": family,
                "class_index": idx,
            }
        )

    entries.sort(key=lambda row: str(row["species"]).lower())

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(entries, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(entries)} bird species to {OUTPUT_PATH}")

    common_path = SERVER / "data" / "scientific-common.json"
    common_map = {
        str(entry["scientific_name"]).strip().lower(): str(entry["species"])
        for entry in entries
    }
    common_path.write_text(
        json.dumps(common_map, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(common_map)} scientific names to {common_path}")


if __name__ == "__main__":
    main()
