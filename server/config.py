from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # When true, no ML libraries are required — endpoints return mock predictions.
    inference_mock: bool = True

    top_k: int = 3
    min_confidence: float = 0.05

    # Photo validation — off by default so you can test with bird photos on screens.
    image_validation_enabled: bool = False
    validation_min_bird_confidence: float = 0.12
    validation_min_species_margin: float = 0.03
    validation_max_recapture_score: float = 0.50

    # --- Image model (birder) ---
    # Full registry name (recommended). See birder list-models / Hugging Face birder-project.
    image_model_weights: str = "rope_vit_reg4_b14_capi-inat21"
    # Fallback if weights empty: combined as {name}_{tag}
    image_model_name: str = ""
    image_model_tag: str = ""

    # --- Audio model (Google Perch, Apache-2.0) ---
    # Local SavedModel directory, or leave empty and set AUDIO_MODEL_HUB_URL instead.
    audio_model_path: str = ""
    audio_model_hub_url: str = ""
    audio_labels_path: str = ""
    audio_max_seconds: float = 30.0
    audio_max_windows: int = 6
    audio_heard_min_confidence: float = 0.04
    audio_heard_max_species: int = 15
    # How many raw Perch candidates to consider before geo/catalog filtering.
    audio_rerank_candidates: int = 40
    # How many ranked species to return to the client for live sound.
    audio_live_max_results: int = 20
    # Live chunks: max-pool Perch windows so brief calls are not diluted by mean.
    audio_live_use_max_pool: bool = True
    audio_vagrant_confidence: float = 0.35
    # Off-checklist species with zero regional prior need a higher bar (blocks spurious exotics).
    audio_zero_prior_vagrant_confidence: float = 0.55
    audio_detection_min_confidence: float = 0.05
    # Scan ecozone checklist against full Perch softmax (detect weak natives).
    audio_checklist_scan_min_confidence: float = 0.03
    # Secondary checklist injectees need this softmax prob; leader may use scan min.
    audio_checklist_injection_min_confidence: float = 0.05
    # Inject only the loudest checklist hits by logit (avoids flooding with noise).
    audio_acoustic_native_top_k: int = 3
    # Drop checklist hawks/owls/falcons when the native logit leader is stronger.
    audio_acoustic_logit_margin: float = 0.35
    # Do not inject raptor/owl/falcon checklist species below this unless raw Perch hit.
    audio_raptor_injection_min_confidence: float = 0.08
    # Prefer Blue Jay over hawk/owl/falcon when jay logit is within this margin.
    audio_jay_mimic_logit_margin: float = 1.0
    # Prune injected mimic confusers below this when Jay is logit-competitive.
    audio_mimic_confuser_prune_max_confidence: float = 0.12
    # Perch confuses phone-recorded Blue Jay calls for impossible-in-NA exotics
    # (e.g. Cyanochen cyanoptera). Redirect such high-confidence hits to Blue Jay.
    audio_jay_exotic_redirect_min_confidence: float = 0.35
    # Require the true Blue Jay class to carry at least this logit before redirecting.
    audio_jay_min_redirect_logit: float = 0.0
    # Same-genus checklist species (e.g. American Crow vs Common Raven): drop a congener
    # trailing the logit leader by more than this margin; keep both when acoustically close.
    audio_congener_disambiguation_logit_margin: float = 1.5
    # Calibration: Common Raven's logit runs hot vs American Crow (cosmopolitan, far more Perch
    # training data; Perch also routes both NA corvids onto off-continent Corvus attractors).
    # Subtracting this from the raven logit makes the genuine corax-vs-brachyrhynchos pair a
    # reliable crow/raven discriminator. Tuned from AUDIO_DEBUG corvid logits (raven clips:
    # corax−brachyrhynchos ≈ 5–7; crow clips ≈ 2.5–4, so a ~4.5 boundary cleanly separates them).
    audio_common_raven_logit_bias: float = 4.5
    # Minimum Corvus-attractor softmax before the crow/raven resolver acts (e.g. Perch routing a
    # call to Little Crow / Cape Crow). Below this we are not confident it is a corvid at all.
    audio_corvid_type_min_confidence: float = 0.10
    # Client display scoring: Top-K native species, temperature-sharpened softmax.
    audio_softmax_temperature: float = 0.6
    audio_display_top_k: int = 5
    # Log raw Perch vs final predictions and key species softmax (AUDIO_DEBUG=true).
    audio_debug: bool = False

    regional_min_expected_freq: float = 0.001
    regional_vagrant_confidence: float = 0.55
    regional_geo_alpha: float = 0.4
    regional_geo_epsilon: float = 0.02

    def resolved_image_weights(self) -> str:
        if self.image_model_weights.strip():
            return self.image_model_weights.strip()
        if self.image_model_tag.strip():
            return f"{self.image_model_name}_{self.image_model_tag}"
        return self.image_model_name
    def audio_is_live(self) -> bool:
        if self.inference_mock:
            return False
        return bool(
            self.audio_model_path.strip() or self.audio_model_hub_url.strip()
        )

    def resolved_audio_model_path(self) -> str:
        path = self.audio_model_path.strip()
        if path.replace("\\", "/").endswith("saved_model.pb"):
            from pathlib import Path

            return str(Path(path).parent)
        return path


settings = Settings()
