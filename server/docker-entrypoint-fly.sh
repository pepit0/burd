#!/bin/sh
set -e

# Birder weights download on first boot (keeps image under Fly rootfs limit).
MARKER="/root/.cache/birder/fly-weights-ready"
mkdir -p /root/.cache/birder /root/.cache/tfhub

if [ ! -f "$MARKER" ]; then
  echo "First boot: downloading birder weights (rope_vit_reg4_b14_capi-inat21)..."
  if python -m birder.tools download-model rope_vit_reg4_b14_capi-inat21; then
    touch "$MARKER"
  else
    echo "WARN: birder weight download failed; photo ID may be unavailable"
  fi
fi

exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
