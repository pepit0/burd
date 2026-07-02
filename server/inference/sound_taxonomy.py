"""Full Perch sound taxonomy (~14k species) — separate from photo catalog."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_INDEX_PATHS = (
    Path(__file__).resolve().parent.parent.parent / "data" / "sound-taxonomy-index.json",
    Path(__file__).resolve().parent.parent / "data" / "sound-taxonomy-index.json",
)
_TAXONOMY_PATHS = (
    Path(__file__).resolve().parent.parent.parent / "data" / "sound-taxonomy.json",
    Path(__file__).resolve().parent.parent / "data" / "sound-taxonomy.json",
)


def _normalize_scientific(name: str) -> str:
    parts = name.strip().lower().replace("_", " ").split()
    if len(parts) < 2:
        return name.strip().lower()
    return f"{parts[0]} {parts[1]}"


@lru_cache(maxsize=1)
def load_scientific_to_class_index() -> dict[str, int]:
    for path in _TAXONOMY_PATHS:
        if path.is_file():
            payload = json.loads(path.read_text(encoding="utf-8"))
            mapping: dict[str, int] = {}
            for row in payload.get("species", []):
                scientific = str(row.get("scientific_name", "")).strip().lower()
                idx = row.get("perch_class_index")
                if scientific and isinstance(idx, int):
                    mapping[scientific] = idx
            if mapping:
                return mapping
    return {}


def class_index_for_scientific(scientific_name: str | None) -> int | None:
    key = _normalize_scientific(scientific_name or "")
    if not key:
        return None
    return load_scientific_to_class_index().get(key)


@lru_cache(maxsize=1)
def load_sound_taxonomy_index() -> dict[str, str]:
    for path in _INDEX_PATHS:
        if path.is_file():
            raw = json.loads(path.read_text(encoding="utf-8"))
            return {str(k).strip().lower(): str(v) for k, v in raw.items()}
    return {}


@lru_cache(maxsize=1)
def load_sound_taxonomy_species() -> frozenset[str]:
    return frozenset(load_sound_taxonomy_index().keys())


def is_in_sound_taxonomy(scientific_name: str | None) -> bool:
    key = _normalize_scientific(scientific_name or "")
    if not key:
        return False
    return key in load_sound_taxonomy_species()


def common_name_for_scientific(scientific_name: str | None) -> str | None:
    key = _normalize_scientific(scientific_name or "")
    if not key:
        return None
    return load_sound_taxonomy_index().get(key)
