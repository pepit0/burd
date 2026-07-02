"""Generate data/bird-catalog.json from the birder iNat21 model (Aves only).

Deprecated: prefer scripts/generate-photo-taxonomy.py (full catalog + bird subset).

Run from repo root:
  node scripts/run-python.mjs scripts/generate-bird-catalog.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "generate-photo-taxonomy.py"


def main() -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--birds-only"],
        cwd=ROOT,
    )
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
