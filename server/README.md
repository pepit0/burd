# Burd Inference API

Identifies bird species from a **photo** (birder) or **sound clip** (Google Perch, planned).

- `GET /health` — service status, model checkpoint, license notes
- `POST /identify/image` — multipart field `image`
- `POST /identify/audio` — multipart field `audio` (mock only until Perch is wired)

## Quick start (mock mode — no ML)

```bash
cd server
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Set `EXPO_PUBLIC_INFERENCE_URL=http://<your-LAN-ip>:8000` in the app `.env`.

## Enable real birder (photo ID)

**Requirements:** Python **3.11–3.13** recommended (PyTorch/birder may not support 3.14 yet).

```bash
pip install -r requirements.txt -r requirements-ml.txt
# Install torch for your platform first if pip fails: https://pytorch.org

# Download weights (~hundreds of MB, one-time)
python -m birder.tools download-model rope_vit_reg4_b14_capi-inat21

# Switch off mock mode
# In .env: INFERENCE_MOCK=false
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Verify:

```bash
curl http://127.0.0.1:8000/health
```

You should see `"mock": false`, `"image": { "loaded": true, "weights": "rope_vit_reg4_b14_capi-inat21", ... }`.

Change checkpoint via `.env`:

```
IMAGE_MODEL_WEIGHTS=rope_vit_reg4_b14_capi-inat21-224px
```

Run `/health` after startup — it reports `weights_license`, `commercial_status`, and `license_note` for ops/legal review.

## Licensing (commercial apps)

| Component | License |
|---|---|
| birder **code** | Apache-2.0 |
| birder **pretrained weights** | **Verify per checkpoint** — some derive from ImageNet or CC-BY-NC |
| Perch audio (when wired) | Apache-2.0 |

See `inference/licenses.py` for Burd's registry of known checkpoints. **Do not ship commercially without verifying the exact weight license.**

## Health response example

```json
{
  "ok": true,
  "mock": false,
  "image": {
    "loaded": true,
    "mock": false,
    "weights": "rope_vit_reg4_b14_capi-inat21",
    "code_license": "Apache-2.0",
    "weights_license": "Apache-2.0",
    "commercial_status": "review_required",
    "license_note": "...",
    "num_classes": 10000,
    "load_error": null
  },
  "audio": { "mock": true, "loaded": false, ... }
}
```
