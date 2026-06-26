"""Turn birder / Perch class labels into display species + scientific name."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_INAT21_MAPPING = _DATA_DIR / "inat21-mapping.json"
_SCIENTIFIC_COMMON = _DATA_DIR / "scientific-common.json"
_BIRD_CATALOG = _REPO_ROOT / "data" / "bird-catalog.json"

_BINOMIAL_RE = re.compile(r"^[A-Z][a-z]+ [a-z][a-z-]+$")


@lru_cache(maxsize=1)
def _inat21_common_names() -> dict[str, str]:
    if not _INAT21_MAPPING.is_file():
        return {}
    with _INAT21_MAPPING.open(encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=1)
def _scientific_to_common() -> dict[str, str]:
    if _SCIENTIFIC_COMMON.is_file():
        with _SCIENTIFIC_COMMON.open(encoding="utf-8") as fh:
            raw = json.load(fh)
        return {key.strip().lower(): value for key, value in raw.items()}

    if _BIRD_CATALOG.is_file():
        with _BIRD_CATALOG.open(encoding="utf-8") as fh:
            entries = json.load(fh)
        return {
            entry["scientific_name"].strip().lower(): entry["species"]
            for entry in entries
            if entry.get("scientific_name") and entry.get("species")
        }

    return {}


def _lookup_common(scientific: str) -> str:
    common = _scientific_to_common().get(scientific.strip().lower())
    return common if common else scientific


def _binomial_from_underscores(text: str) -> str | None:
    """Parse ``Turdus_migratorius`` or ``..._Turdus_migratorius`` taxa paths."""
    parts = [part for part in text.split("_") if part]
    if len(parts) < 2:
        return None

    genus, epithet = parts[-2], parts[-1]
    if not genus[:1].isupper():
        return None
    if not epithet.replace("-", "").isalpha():
        return None

    scientific = f"{genus} {epithet}"
    return scientific if _BINOMIAL_RE.match(scientific) else None


def _parse_inat21_label(label: str, class_idx: int | None = None) -> tuple[str, str] | None:
    """Parse iNat21 labels like ``03112_Animalia_..._Accipiter_cooperii``."""
    parts = label.split("_")
    if len(parts) < 3 or not parts[0].isdigit():
        return None

    idx = class_idx if class_idx is not None else int(parts[0])
    scientific = f"{parts[-2]} {parts[-1]}"
    common = _inat21_common_names().get(str(idx))
    if common:
        return common, scientific
    return _lookup_common(scientific), scientific


def label_to_names(label: str, class_idx: int | None = None) -> tuple[str, str | None]:
    """Parse a model label into (display species, scientific name).

    Labels vary by dataset:
    - iNat21: ``03112_Animalia_Chordata_Aves_..._Accipiter_cooperii``
    - Perch: ``Turdus_migratorius`` or ``turdus_migratorius``
    - Hierarchical: ``Aves: Passeriformes: Turdus migratorius``
    - Plain binomial: ``Turdus migratorius``
    """
    text = label.strip()
    if not text:
        return "Unknown", None

    inat21 = _parse_inat21_label(text, class_idx)
    if inat21 is not None:
        return inat21[0], inat21[1]

    if ":" in text:
        text = text.split(":")[-1].strip()

    if " " in text:
        parts = text.split()
        if len(parts) >= 2:
            scientific = f"{parts[0]} {parts[1]}"
            return _lookup_common(scientific), scientific

    scientific = _binomial_from_underscores(text)
    if scientific:
        return _lookup_common(scientific), scientific

    cleaned = text.replace("_", " ").strip()
    if _BINOMIAL_RE.match(cleaned):
        return _lookup_common(cleaned), cleaned

    return cleaned.title() if cleaned else text, None
