#!/bin/sh
set -e

# Models (birder + Perch) are baked into the image at build time. If the birder
# weights file is somehow missing, fall back to a runtime download so photo ID
# can recover instead of the app crash-looping.
mkdir -p /root/.cache/tfhub models

if ! ls models/rope_vit_reg4_b14_capi-inat21*.pt >/dev/null 2>&1; then
  echo "Birder weights missing; downloading at boot..."
  python -m birder.tools download-model rope_vit_reg4_b14_capi-inat21 || \
    echo "WARN: birder weight download failed; photo ID may be unavailable"
fi

exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
