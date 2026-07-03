#!/bin/sh
set -e

# Birder weights are downloaded on first boot to keep the Docker image under
# Fly's rootfs unpack limit. With rootfs persist=restart, the cache survives
# autostop/restart.
MARKER="/root/.cache/birder/fly-weights-ready"
mkdir -p /root/.cache/birder /root/.cache/tfhub

if [ ! -f "$MARKER" ]; then
  echo "First boot: downloading birder weights (rope_vit_reg4_b14_capi-inat21)..."
  python -m birder.tools download-model rope_vit_reg4_b14_capi-inat21
  touch "$MARKER"
fi

exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
