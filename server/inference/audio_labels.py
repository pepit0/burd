"""Load Perch / bird vocalization classifier label files."""

from __future__ import annotations

import csv
import logging
from functools import lru_cache
from pathlib import Path

from config import settings

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@lru_cache(maxsize=1)
def load_audio_labels() -> dict[int, str]:
    """Return class index -> label string (usually scientific name)."""
    candidates = [
        Path(settings.audio_labels_path) if settings.audio_labels_path.strip() else None,
        _DATA_DIR / "perch-labels.csv",
    ]
    model_path = settings.resolved_audio_model_path()
    if model_path:
        root = Path(model_path)
        candidates.extend(
            [
                root / "assets" / "labels.csv",
                root / "labels.csv",
                root.parent / "assets" / "labels.csv",
            ]
        )

    for path in candidates:
        if path is None or not path.is_file():
            continue
        labels = _read_labels_csv(path)
        if labels:
            logger.info("Loaded %s audio labels from %s", len(labels), path)
            return labels

    logger.warning("No audio labels file found — class indices will be used as names.")
    return {}


def _read_labels_csv(path: Path) -> dict[int, str]:
    labels: dict[int, str] = {}
    with path.open(encoding="utf-8", newline="") as fh:
        reader = csv.reader(fh)
        rows = list(reader)
    if not rows:
        return labels

    header = [cell.strip().lower() for cell in rows[0]]
    start = 0
    label_col = 0
    if "label" in header or "scientific_name" in header or "name" in header:
        start = 1
        for idx, cell in enumerate(header):
            if cell in {"label", "scientific_name", "name", "species"}:
                label_col = idx
                break

    for row_idx, row in enumerate(rows[start:], start=start):
        if not row or not row[label_col].strip():
            continue
        class_idx = row_idx - start
        labels[class_idx] = row[label_col].strip()
    return labels
