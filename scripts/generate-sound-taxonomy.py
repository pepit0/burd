"""Generate sound-taxonomy.json from Perch labels.csv (~14k bird classes).

Run from repo root:
  node scripts/run-python.mjs scripts/generate-sound-taxonomy.py
  node scripts/run-python.mjs scripts/generate-sound-taxonomy.py --labels C:/models/perch_v2_cpu/assets/labels.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SERVER_DATA = ROOT / "server" / "data"
COMMON_PATH = SERVER_DATA / "scientific-common.json"
OUTPUT_PATH = DATA_DIR / "sound-taxonomy.json"
INDEX_PATH = DATA_DIR / "sound-taxonomy-index.json"

BINOMIAL_RE = re.compile(r"^[A-Za-z-]+ [A-Za-z-]+$")
BACKGROUND_LABELS = frozenset({"inat2024_fsd50k", "background", "noise"})


def normalize_scientific(label: str) -> str | None:
    text = label.strip().lower().replace("_", " ")
    parts = text.split()
    if len(parts) < 2:
        return None
    candidate = f"{parts[0]} {parts[1]}"
    return candidate if BINOMIAL_RE.match(candidate) else None


def title_case_scientific(scientific: str) -> str:
    parts = scientific.split()
    return " ".join(p.capitalize() for p in parts)


def load_common_names() -> dict[str, str]:
    if not COMMON_PATH.is_file():
        return {}
    raw = json.loads(COMMON_PATH.read_text(encoding="utf-8"))
    return {str(k).strip().lower(): str(v) for k, v in raw.items()}


def find_labels_path(explicit: str | None) -> Path | None:
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    candidates.extend(
        [
            SERVER_DATA / "perch-labels.csv",
            ROOT / "server" / "data" / "perch-labels.csv",
            Path("C:/models/perch_v2_cpu/assets/labels.csv"),
        ]
    )
    for path in candidates:
        if path.is_file():
            return path
    return None


def read_labels(path: Path) -> list[str]:
    with path.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.reader(fh))
    if not rows:
        return []

    header = [cell.strip().lower() for cell in rows[0]]
    start = 0
    label_col = 0
    if any(h in header for h in ("label", "scientific_name", "name", "species")):
        start = 1
        for idx, cell in enumerate(header):
            if cell in {"label", "scientific_name", "name", "species"}:
                label_col = idx
                break

    labels: list[str] = []
    for row in rows[start:]:
        if not row or not row[label_col].strip():
            labels.append("")
            continue
        labels.append(row[label_col].strip())
    return labels


def build_taxonomy(labels: list[str], common: dict[str, str]) -> tuple[list[dict], dict[str, str]]:
    entries: list[dict] = []
    index: dict[str, str] = {}

    for class_index, label in enumerate(labels):
        if not label:
            continue
        if label.strip().lower() in BACKGROUND_LABELS:
            continue

        scientific = normalize_scientific(label)
        if not scientific:
            continue

        common_name = common.get(scientific) or title_case_scientific(scientific)
        entries.append(
            {
                "perch_class_index": class_index,
                "scientific_name": scientific,
                "common_name": common_name,
                "is_binomial": True,
            }
        )
        index[scientific] = common_name

    return entries, index


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Perch sound taxonomy JSON")
    parser.add_argument("--labels", default="", help="Path to Perch labels.csv")
    args = parser.parse_args()

    labels_path = find_labels_path(args.labels.strip() or None)
    if labels_path is None:
        raise SystemExit(
            "No labels.csv found. Pass --labels or copy Perch assets to server/data/perch-labels.csv"
        )

    print(f"Reading {labels_path}...")
    labels = read_labels(labels_path)
    common = load_common_names()
    entries, index = build_taxonomy(labels, common)

    payload = {
        "version": 1,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "source": str(labels_path),
        "class_count": len(labels),
        "species_count": len(entries),
        "species": entries,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    INDEX_PATH.write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")

    SERVER_DATA.mkdir(parents=True, exist_ok=True)
    server_copy = SERVER_DATA / "sound-taxonomy-index.json"
    server_copy.write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")

    print(f"Wrote {OUTPUT_PATH} ({len(entries)} species)")
    print(f"Wrote {INDEX_PATH} ({len(index)} index entries)")


if __name__ == "__main__":
    main()
