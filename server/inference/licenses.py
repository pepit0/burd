"""Known birder checkpoint license notes for /health and ops visibility.

Birder library code is Apache-2.0. Pretrained *weights* may have additional
restrictions — always verify before a commercial launch.
"""

from typing import Any

# Keys are full birder registry weight names.
MODEL_LICENSE_INFO: dict[str, dict[str, Any]] = {
    "rope_vit_reg4_b14_capi-inat21": {
        "weights_license": "Apache-2.0",
        "commercial_status": "review_required",
        "note": (
            "Default checkpoint. RoPE ViT fine-tuned on iNaturalist 2021 (~10k classes, "
            "336×336 input). Hugging Face model card lists Apache-2.0: "
            "https://huggingface.co/birder-project/rope_vit_reg4_b14_capi-inat21 — "
            "still confirm iNaturalist dataset terms for commercial inference. "
            "Class labels are scientific names; partial common-name mapping at "
            "birder public_datasets_metadata/inat21-mapping.json. "
            "Lighter 224px variant: rope_vit_reg4_b14_capi-inat21-224px."
        ),
    },
    "rope_vit_reg4_b14_capi-inat21-224px": {
        "weights_license": "Apache-2.0",
        "commercial_status": "review_required",
        "note": "224×224 variant of rope_vit_reg4_b14_capi-inat21 — faster, slightly lower accuracy.",
    },
    "mvit_v2_t_il-all": {
        "weights_license": "Verify before commercial use",
        "commercial_status": "review_required",
        "note": (
            "Legacy default. Trained on birder's il-all bird dataset. "
            "Some birder checkpoints derive from ImageNet or CC-BY-NC sources."
        ),
    },
    "uniformer_s_eu-common": {
        "weights_license": "Verify before commercial use",
        "commercial_status": "review_required",
        "note": "EU common-species checkpoint (707 classes). Confirm training-data license.",
    },
    "resnet_v2_50_inat21": {
        "weights_license": "Verify before commercial use",
        "commercial_status": "review_required",
        "note": (
            "iNaturalist 2021 taxonomy (~10k classes). Class labels are scientific names; "
            "partial common-name mapping at birder public_datasets_metadata/inat21-mapping.json."
        ),
    },
}

DEFAULT_LICENSE_INFO: dict[str, Any] = {
    "weights_license": "Unknown — verify before commercial use",
    "commercial_status": "review_required",
    "note": (
        "No entry in Burd's license registry for this checkpoint. "
        "Run `python -m birder.tools model-info` and review birder's "
        "pretrained weight disclaimers before commercial deployment."
    ),
}


def get_model_license_info(weights: str) -> dict[str, Any]:
    return MODEL_LICENSE_INFO.get(weights, DEFAULT_LICENSE_INFO)
