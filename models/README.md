# Model weights (not in Git)

The Birder image model is too large for GitHub (>100 MB). Download locally:

```bash
# From Hugging Face (see server/README.md for full setup)
huggingface-cli download birder-project/rope_vit_reg4_b14_capi-inat21 --local-dir models/rope_vit_reg4_b14_capi-inat21
```

Or place `rope_vit_reg4_b14_capi-inat21.pt` in this folder and point `IMAGE_MODEL_PATH` in `server/.env`.
