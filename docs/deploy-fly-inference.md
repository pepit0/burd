# Deploy burd-inference to Fly.io

TestFlight Photo ID and Sound ID use **`https://burd-inference.fly.dev`** — a **Python** server in `server/`, **not** the Expo app at the repo root.

## One-time setup (5 minutes)

### 1. Fly API token

1. Open https://fly.io/user/personal_access_tokens
2. **Create token** → copy it

### 2. GitHub secret

1. Open https://github.com/pepit0/burd/settings/secrets/actions
2. **New repository secret**
   - Name: `FLY_API_TOKEN`
   - Value: paste the token

### 3. Fly secrets (burd-inference app)

Open https://fly.io/apps/burd-inference/secrets and set:

| Secret | Example / notes |
|--------|------------------|
| `INFERENCE_MOCK` | `false` |
| `AUDIO_MODEL_HUB_URL` | Your Perch hub URL (same as when sound worked locally) |
| `AUDIO_LABELS_PATH` | `/app/data/perch-labels.csv` |

Photo model weights are baked into the Docker image at build time.

### 4. Deploy

Merge the fix branch to `main`, or run the GitHub Action manually:

1. https://github.com/pepit0/burd/actions/workflows/deploy-inference.yml
2. **Run workflow** → branch `cursor/fix-sound-id-server-upload-b7b5` or `main`

GitHub builds **`server/Dockerfile.fly`** and deploys to **`burd-inference`** on port **8000**.

### 5. Verify (wait ~5 minutes after deploy)

Logs should show:

```text
uvicorn main:app --host 0.0.0.0 --port 8000
Loaded birder weights=...
Loaded ... audio labels from /app/data/perch-labels.csv
```

Browser:

```text
https://burd-inference.fly.dev/health
```

## Two Fly apps — do not mix them

| App | Folder | Process | Port |
|-----|--------|---------|------|
| **burd-inference** | `server/` | uvicorn | 8000 |
| **burd-rg1taa** | repo root | expo/npm | 3000 |

If burd-inference logs show `expo start`, the wrong folder was deployed — re-run the GitHub Action above.
