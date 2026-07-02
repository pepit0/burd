"""Compare server na.sqlite priors vs client na-priors.json for sample ecozone cells."""

from __future__ import annotations

import json
import math
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "regional-priors"
ECOZONES_PATH = ROOT / "data" / "ecozones.json"
SQLITE_PATH = DATA_DIR / "na.sqlite"
JSON_PATH = DATA_DIR / "na-priors.json"

NA_GRID = 1


def cell_id(lat: float, lng: float, grid_deg: float) -> str:
    lat_band = math.floor(lat / grid_deg) * grid_deg
    lng_band = math.floor(lng / grid_deg) * grid_deg
    return f"{int(lat_band)}_{int(lng_band)}"


def sample_point(zone: dict) -> tuple[float, float]:
    lat = (zone["minLat"] + zone["maxLat"]) / 2
    lng = (zone["minLng"] + zone["maxLng"]) / 2
    return lat, lng


def sqlite_top_species(cell: str, month: int, limit: int = 10) -> list[tuple[str, float]]:
    conn = sqlite3.connect(SQLITE_PATH)
    rows = conn.execute(
        """
        SELECT scientific_name, frequency
        FROM cell_priors
        WHERE cell_id = ? AND month = ?
        ORDER BY frequency DESC
        LIMIT ?
        """,
        (cell, month, limit),
    ).fetchall()
    conn.close()
    return [(species, float(freq)) for species, freq in rows]


def json_top_species(cells: dict, cell: str, month: int, limit: int = 10) -> list[tuple[str, float]]:
    month_map = cells.get(cell, {}).get(str(month), {})
    ranked = sorted(
        ((species, entry.get("f", 0)) for species, entry in month_map.items()),
        key=lambda item: item[1],
        reverse=True,
    )
    return ranked[:limit]


def main() -> None:
    if not SQLITE_PATH.is_file() or not JSON_PATH.is_file():
        print("Missing na.sqlite or na-priors.json", file=sys.stderr)
        raise SystemExit(1)

    payload = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    cells = payload.get("cells", {})
    zones = json.loads(ECOZONES_PATH.read_text(encoding="utf-8"))["zones"]
    month = 6
    mismatches = 0

    print(f"Auditing {len(zones)} ecozones (month={month}, top-5 overlap)...")
    for zone in zones:
        lat, lng = sample_point(zone)
        cell = cell_id(lat, lng, NA_GRID)
        server_top = sqlite_top_species(cell, month, limit=5)
        client_top = json_top_species(cells, cell, month, limit=5)

        server_set = {species for species, _ in server_top}
        client_set = {species for species, _ in client_top}
        overlap = len(server_set & client_set)
        status = "ok" if overlap >= min(3, len(server_top), len(client_top)) else "WARN"

        if status != "ok":
            mismatches += 1

        print(
            f"  {zone['id']:20} cell={cell:10} overlap={overlap}/5 "
            f"server={len(server_top)} client={len(client_top)} [{status}]"
        )

    if mismatches:
        print(f"\n{mismatches} zone(s) with low overlap — regenerate na-priors.json if needed.")
        raise SystemExit(1)

    print("\nParity check passed.")


if __name__ == "__main__":
    main()
