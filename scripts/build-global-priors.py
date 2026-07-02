"""Build global GBIF cell priors (2° grid) filtered to Perch sound taxonomy.

Run from repo root:
  node scripts/run-python.mjs scripts/build-global-priors.py --sample
  node scripts/run-python.mjs scripts/build-global-priors.py --max-records 50000 --month-stratify

Requires data/sound-taxonomy-index.json (see scripts/generate-sound-taxonomy.py).
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD_SCRIPT = ROOT / "scripts" / "build-regional-priors.py"


def main() -> None:
    parser = argparse.ArgumentParser(description="Build global sound-taxonomy priors")
    parser.add_argument("--sample", action="store_true", help="Use expanded fixture data")
    parser.add_argument(
        "--max-records",
        type=int,
        default=50_000,
        help="Max GBIF records (API mode)",
    )
    parser.add_argument("--merge", action="store_true", help="Merge into existing sqlite")
    parser.add_argument(
        "--month-stratify",
        action="store_true",
        help="Fetch evenly across months 1-12",
    )
    args = parser.parse_args()

    cmd = [
        sys.executable,
        str(BUILD_SCRIPT),
        "--region",
        "global",
        "--sound-taxonomy-only",
    ]
    if args.sample:
        cmd.append("--sample")
    else:
        cmd.extend(["--max-records", str(args.max_records)])
    if args.merge:
        cmd.append("--merge")
    if args.month_stratify:
        cmd.append("--month-stratify")

    result = subprocess.run(cmd, cwd=ROOT)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
