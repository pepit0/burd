"""Merge Supabase regional_sighting_counts into bundled priors (admin/cron).

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.

Run from repo root:
  server/.venv/Scripts/python.exe scripts/merge-community-priors.py
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "regional-priors"


def fetch_community_counts() -> dict[tuple[str, int, str], int]:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)

    req = urllib.request.Request(
        f"{url}/rest/v1/regional_sighting_counts?select=cell_id,month,scientific_name,sighting_count",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        rows = json.loads(resp.read().decode("utf-8"))

    counts: dict[tuple[str, int, str], int] = defaultdict(int)
    for row in rows:
        cell = row.get("cell_id")
        month = row.get("month")
        species = (row.get("scientific_name") or "").strip().lower()
        n = int(row.get("sighting_count") or 0)
        if not cell or not species or not month:
            continue
        counts[(cell, int(month), species)] += n
    return counts


def merge_into_sqlite(region: str, community: dict[tuple[str, int, str], int]) -> None:
    path = DATA_DIR / f"{region}.sqlite"
    if not path.is_file():
        print(f"Skip {path} — not found")
        return

    conn = sqlite3.connect(path)
    for (cell, month, species), count in community.items():
        conn.execute(
            """
            UPDATE cell_priors
            SET raw_count = raw_count + ?, frequency = frequency + ?
            WHERE cell_id = ? AND month = ? AND scientific_name = ?
            """,
            (count, count * 0.0001, cell, month, species),
        )
    conn.commit()
    conn.close()
    print(f"Merged community counts into {path}")


def main() -> None:
    community = fetch_community_counts()
    if not community:
        print("No community counts returned.")
        return
    merge_into_sqlite("na", community)
    merge_into_sqlite("global", community)


if __name__ == "__main__":
    main()
