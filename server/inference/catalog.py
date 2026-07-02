"""Vision-catalog species list — full ~10k iNat21 taxa as the mobile app."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_CATALOG_PATHS = (
    _REPO_ROOT / "data" / "photo-catalog.json",
    _REPO_ROOT / "data" / "bird-catalog.json",
)


def _normalize_scientific(name: str) -> str:
    parts = name.strip().lower().replace("_", " ").split()
    if len(parts) < 2:
        return name.strip().lower()
    return f"{parts[0]} {parts[1]}"


def _catalog_path() -> Path:
    for path in _CATALOG_PATHS:
        if path.is_file():
            return path
    return _CATALOG_PATHS[0]


@lru_cache(maxsize=1)
def load_catalog_species() -> frozenset[str]:
    path = _catalog_path()
    if not path.is_file():
        return frozenset()
    rows = json.loads(path.read_text(encoding="utf-8"))
    names = {
        _normalize_scientific(row["scientific_name"])
        for row in rows
        if row.get("scientific_name")
    }
    return frozenset(names)


def is_in_catalog(scientific_name: str | None) -> bool:
    key = _normalize_scientific(scientific_name or "")
    if not key:
        return False
    return key in load_catalog_species()
