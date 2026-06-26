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
