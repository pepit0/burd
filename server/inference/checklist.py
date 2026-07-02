"""Merlin-style ecozone species checklists (offline fallback)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "regional-priors"
ROOT_DATA = Path(__file__).resolve().parent.parent.parent / "data" / "regional-priors"
ECOZONES_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "ecozones.json"


def _checklist_path() -> Path:
    for candidate in (DATA_DIR / "ecozone-checklist.json", ROOT_DATA / "ecozone-checklist.json"):
        if candidate.is_file():
            return candidate
    return DATA_DIR / "ecozone-checklist.json"

CHECKLIST_MONTH_PRIOR = 0.05
CHECKLIST_ALL_MONTH_PRIOR = 0.02


def _normalize_scientific(name: str) -> str:
    parts = name.strip().lower().replace("_", " ").split()
    if len(parts) < 2:
        return name.strip().lower()
    return f"{parts[0]} {parts[1]}"


@lru_cache(maxsize=1)
def _load_ecozones() -> list[dict]:
    if not ECOZONES_PATH.is_file():
        return []
    payload = json.loads(ECOZONES_PATH.read_text(encoding="utf-8"))
    return payload.get("zones", [])


@lru_cache(maxsize=1)
def _load_checklist() -> dict:
    path = _checklist_path()
    if not path.is_file():
        return {"zones": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def ecozone_for_coords(lat: float, lng: float) -> str | None:
    best: tuple[str, float] | None = None
    for zone in _load_ecozones():
        if not (
            zone["minLat"] <= lat <= zone["maxLat"]
            and zone["minLng"] <= lng <= zone["maxLng"]
        ):
            continue
        area = (zone["maxLat"] - zone["minLat"]) * (zone["maxLng"] - zone["minLng"])
        if best is None or area < best[1]:
            best = (zone["id"], area)
    return best[0] if best else None


def checklist_prior(lat: float, lng: float, month: int, scientific_name: str) -> float:
    key = _normalize_scientific(scientific_name)
    if not key:
        return 0.0

    zone_id = ecozone_for_coords(lat, lng)
    if not zone_id:
        return 0.0

    zones = _load_checklist().get("zones", {})
    zone = zones.get(zone_id)
    if not zone:
        return 0.0

    months = zone.get("months", {})
    month_list = months.get(str(month), [])
    if any(_normalize_scientific(s) == key for s in month_list):
        return CHECKLIST_MONTH_PRIOR

    all_list = months.get("all", [])
    if any(_normalize_scientific(s) == key for s in all_list):
        return CHECKLIST_ALL_MONTH_PRIOR

    return 0.0


def has_checklist_data(lat: float, lng: float) -> bool:
    zone_id = ecozone_for_coords(lat, lng)
    if not zone_id:
        return False
    zone = _load_checklist().get("zones", {}).get(zone_id)
    if not zone:
        return False
    return bool(zone.get("months", {}).get("all"))


def checklist_species_for_coords(lat: float, lng: float, month: int) -> frozenset[str]:
    """All checklist species for this ecozone (month list + all-year union)."""
    zone_id = ecozone_for_coords(lat, lng)
    if not zone_id:
        return frozenset()

    zone = _load_checklist().get("zones", {}).get(zone_id)
    if not zone:
        return frozenset()

    names: set[str] = set()
    months = zone.get("months", {})
    for species in months.get(str(month), []):
        key = _normalize_scientific(species)
        if key:
            names.add(key)
    for species in months.get("all", []):
        key = _normalize_scientific(species)
        if key:
            names.add(key)
    return frozenset(names)


def is_on_regional_checklist(lat: float, lng: float, month: int, scientific_name: str) -> bool:
    key = _normalize_scientific(scientific_name)
    if not key:
        return False

    zone_id = ecozone_for_coords(lat, lng)
    if not zone_id:
        return False

    zone = _load_checklist().get("zones", {}).get(zone_id)
    if not zone:
        return False

    months = zone.get("months", {})
    for species in months.get(str(month), []):
        if _normalize_scientific(species) == key:
            return True
    for species in months.get("all", []):
        if _normalize_scientific(species) == key:
            return True
    return False
