from schemas import Prediction
from config import settings
from inference.mock_data import mock_heard_species, mock_predictions
import logging

logger = logging.getLogger(__name__)


class AudioClassifier:
    """Bird species classification from a sound clip.

    Uses Google's Perch / Bird Vocalization Classifier (Apache-2.0) when live —
    a commercial-friendly alternative to BirdNET (which is non-commercial).

    Set AUDIO_MODEL_PATH (local SavedModel) or AUDIO_MODEL_HUB_URL (TF Hub / Kaggle).
    """

    SAMPLE_RATE = 32_000
    WINDOW_SAMPLES = 5 * SAMPLE_RATE

    def __init__(self) -> None:
        self.live = settings.audio_is_live()
        self.mock = not self.live
        self.model_name = settings.resolved_audio_model_path() or "mock-audio"
        if self.live and settings.audio_model_hub_url.strip():
            self.model_name = settings.audio_model_hub_url.strip()
        self._infer = None
        self._labels: dict[int, str] = {}
        self._last_mean_probs = None
        self._last_mean_logits = None
        self.loaded = False
        self.load_error: str | None = None

    def load(self) -> None:
        if not self.live:
            self.loaded = False
            self.load_error = None
            return
        try:
            self._load()
            self.loaded = True
            self.load_error = None
        except Exception as exc:
            self.loaded = False
            self.load_error = str(exc)
            raise

    def status(self) -> dict:
        if self.live:
            note = "Google Perch / Bird Vocalization Classifier (Apache-2.0)."
        elif settings.inference_mock:
            note = "Mock mode — INFERENCE_MOCK=true."
        else:
            note = (
                "Mock responses for /identify/audio. Set AUDIO_MODEL_PATH or "
                "AUDIO_MODEL_HUB_URL to enable real sound ID."
            )
        return {
            "loaded": self.loaded,
            "mock": self.mock,
            "weights": self.model_name if self.live else None,
            "code_license": "Apache-2.0",
            "weights_license": "Apache-2.0" if self.live else None,
            "commercial_status": "ok" if self.live else None,
            "license_note": note,
            "num_classes": len(self._labels) or None,
            "load_error": self.load_error,
        }

    def _load(self) -> None:
        import tensorflow as tf

        hub_url = settings.audio_model_hub_url.strip()
        model_path = settings.resolved_audio_model_path()

        if hub_url:
            import tensorflow_hub as hub

            model = hub.load(hub_url)
        elif model_path:
            model = tf.saved_model.load(model_path)
        else:
            raise ValueError("AUDIO_MODEL_PATH or AUDIO_MODEL_HUB_URL is required.")

        signature = model.signatures.get("serving_default")
        if signature is None:
            signature = next(iter(model.signatures.values()))
        self._infer = signature

        from inference.audio_labels import load_audio_labels

        self._labels = load_audio_labels()

    def predict(
        self,
        audio_bytes: bytes,
        *,
        live: bool = False,
    ) -> tuple[list[Prediction], list[Prediction]]:
        if self.mock:
            rows = mock_predictions(settings.top_k)
            predictions = [
                Prediction(species=c, scientific_name=s, confidence=conf)
                for c, s, conf in rows
            ]
            heard_rows = mock_heard_species(
                settings.audio_heard_max_species,
                settings.audio_heard_min_confidence,
            )
            heard = [
                Prediction(species=c, scientific_name=s, confidence=conf)
                for c, s, conf in heard_rows
            ]
            return predictions, heard
        if not self.loaded or self._infer is None:
            raise RuntimeError("Audio model is not loaded")
        return self._predict(audio_bytes, live=live)

    def _decode_audio(self, audio_bytes: bytes):
        import tempfile
        from pathlib import Path

        import librosa
        import numpy as np

        suffix = ".m4a"
        if audio_bytes[:4] == b"RIFF":
            suffix = ".wav"
        elif audio_bytes[:3] == b"ID3" or audio_bytes[:2] in (b"\xff\xfb", b"\xff\xf3"):
            suffix = ".mp3"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = Path(tmp.name)

        try:
            waveform, _ = librosa.load(
                tmp_path,
                sr=self.SAMPLE_RATE,
                mono=True,
                duration=settings.audio_max_seconds,
                res_type="kaiser_best",
            )
        finally:
            tmp_path.unlink(missing_ok=True)

        return np.asarray(waveform, dtype=np.float32)

    def _prediction_from_index(self, idx_int: int, confidence: float) -> Prediction:
        from inference.label_utils import label_to_names

        label = self._labels.get(idx_int, f"class_{idx_int}")
        species, scientific = label_to_names(label, class_idx=idx_int)
        return Prediction(
            species=species,
            scientific_name=scientific,
            confidence=round(confidence, 4),
        )

    def _predictions_above_threshold(
        self,
        probs,
        min_confidence: float,
        *,
        sound_taxonomy_only: bool = False,
    ) -> list[Prediction]:
        import numpy as np

        order = np.argsort(probs)[::-1]
        predictions: list[Prediction] = []

        for idx in order:
            conf = float(probs[idx])
            if conf < min_confidence:
                continue
            if int(idx) == 0:
                label = self._labels.get(0, "")
                if label.strip().lower() in {"inat2024_fsd50k", "background"}:
                    continue
            prediction = self._prediction_from_index(int(idx), conf)
            if sound_taxonomy_only:
                from inference.sound_taxonomy import is_in_sound_taxonomy

                key = (prediction.scientific_name or "").strip().lower()
                if not is_in_sound_taxonomy(key):
                    continue
            predictions.append(prediction)

        return predictions

    def _top_predictions(
        self,
        probs,
        top_k: int,
        min_confidence: float,
        *,
        sound_taxonomy_only: bool = False,
    ) -> list[Prediction]:
        import numpy as np

        order = np.argsort(probs)[::-1]
        predictions: list[Prediction] = []

        for idx in order:
            conf = float(probs[idx])
            if int(idx) == 0:
                label = self._labels.get(0, "")
                if label.strip().lower() in {"inat2024_fsd50k", "background"}:
                    continue
            prediction = self._prediction_from_index(int(idx), conf)
            if sound_taxonomy_only:
                from inference.sound_taxonomy import is_in_sound_taxonomy

                key = (prediction.scientific_name or "").strip().lower()
                if not is_in_sound_taxonomy(key):
                    continue
            if conf < min_confidence and predictions:
                break
            if len(predictions) >= top_k:
                break
            predictions.append(prediction)

        if not predictions and len(order) > 0:
            for idx in order:
                if int(idx) == 0:
                    label = self._labels.get(0, "")
                    if label.strip().lower() in {"inat2024_fsd50k", "background"}:
                        continue
                prediction = self._prediction_from_index(int(idx), float(probs[idx]))
                if sound_taxonomy_only:
                    from inference.sound_taxonomy import is_in_sound_taxonomy

                    key = (prediction.scientific_name or "").strip().lower()
                    if not is_in_sound_taxonomy(key):
                        continue
                predictions.append(prediction)
                break

        return predictions

    def _heard_species(self, probs) -> list[Prediction]:
        import numpy as np

        from inference.sound_taxonomy import is_in_sound_taxonomy

        order = np.argsort(probs)[::-1]
        heard: list[Prediction] = []
        seen: set[str] = set()

        for idx in order:
            conf = float(probs[idx])
            if conf < settings.audio_heard_min_confidence:
                break
            if len(heard) >= settings.audio_heard_max_species:
                break
            if int(idx) == 0:
                label = self._labels.get(0, "")
                if label.strip().lower() in {"inat2024_fsd50k", "background"}:
                    continue

            prediction = self._prediction_from_index(int(idx), conf)

            key = (
                (prediction.scientific_name or "").strip().lower()
                or prediction.species.strip().lower()
            )
            if not is_in_sound_taxonomy(key):
                continue
            if key in seen:
                continue
            seen.add(key)
            heard.append(prediction)

        if not heard and len(order) > 0:
            for idx in order:
                if int(idx) == 0:
                    label = self._labels.get(0, "")
                    if label.strip().lower() in {"inat2024_fsd50k", "background"}:
                        continue
                prediction = self._prediction_from_index(int(idx), float(probs[idx]))
                key = (prediction.scientific_name or "").strip().lower()
                if is_in_sound_taxonomy(key):
                    heard.append(prediction)
                    break

        return heard

    def _predict(
        self,
        audio_bytes: bytes,
        *,
        live: bool = False,
    ) -> tuple[list[Prediction], list[Prediction]]:
        import numpy as np
        import tensorflow as tf

        waveform = self._decode_audio(audio_bytes)
        if waveform.size < self.SAMPLE_RATE // 2:
            raise ValueError("Audio clip is too short — record at least one second.")

        windows: list[np.ndarray] = []
        for start in range(0, len(waveform), self.WINDOW_SAMPLES):
            chunk = waveform[start : start + self.WINDOW_SAMPLES]
            if chunk.size < self.WINDOW_SAMPLES:
                chunk = np.pad(chunk, (0, self.WINDOW_SAMPLES - chunk.size))
            windows.append(chunk)
            if len(windows) >= settings.audio_max_windows:
                break

        input_key = next(iter(self._infer.structured_input_signature[1].keys()))
        window_probs: list[np.ndarray] = []
        window_logits: list[np.ndarray] = []

        duration_s = len(waveform) / self.SAMPLE_RATE
        max_amplitude = float(np.max(np.abs(waveform)))
        rms_energy = float(np.sqrt(np.mean(waveform**2)))
        logger.info(
            "Perch input audio: duration=%.3fs max_amplitude=%.6f rms_energy=%.6f",
            duration_s,
            max_amplitude,
            rms_energy,
        )

        for window_idx, chunk in enumerate(windows):
            tensor = tf.constant(chunk.reshape(1, -1), dtype=tf.float32)
            outputs = self._infer(**{input_key: tensor})
            logits = outputs.get("label")
            if logits is None:
                logits = next(iter(outputs.values()))
            probs = tf.nn.softmax(logits[0]).numpy()
            window_probs.append(probs)
            window_logits.append(logits[0].numpy())

            window_order = np.argsort(probs)[::-1][:3]
            window_top = []
            for idx in window_order:
                pred = self._prediction_from_index(int(idx), float(probs[idx]))
                window_top.append(f"{pred.species}={pred.confidence:.4f}")
            logger.info(
                "Perch window %d/%d top-3: %s",
                window_idx + 1,
                len(windows),
                ", ".join(window_top),
            )

        if not window_probs:
            raise ValueError("Could not analyze audio.")

        stacked = np.stack(window_probs, axis=0)
        mean_probs = stacked.mean(axis=0)
        max_probs = stacked.max(axis=0)
        self._last_mean_probs = mean_probs
        if window_logits:
            self._last_mean_logits = np.stack(window_logits, axis=0).mean(axis=0)
        else:
            self._last_mean_logits = None

        raw_order = np.argsort(max_probs)[::-1][:5]
        raw_top = []
        for idx in raw_order:
            pred = self._prediction_from_index(int(idx), float(max_probs[idx]))
            raw_top.append(f"{pred.species}={pred.confidence:.4f}")
        logger.info("Perch top-5 (raw max): %s", ", ".join(raw_top))

        mean_order = np.argsort(mean_probs)[::-1][:5]
        mean_top = []
        for idx in mean_order:
            pred = self._prediction_from_index(int(idx), float(mean_probs[idx]))
            mean_top.append(f"{pred.species}={pred.confidence:.4f}")
        logger.info("Perch top-5 (mean): %s", ", ".join(mean_top))

        use_max = live and settings.audio_live_use_max_pool
        score_probs = max_probs if use_max else mean_probs
        if use_max:
            logger.info("Perch live mode: using max-pool across windows for species output")

        predictions = self._top_predictions(
            score_probs,
            settings.audio_rerank_candidates,
            settings.min_confidence,
            sound_taxonomy_only=True,
        )
        heard = self._heard_species(score_probs)

        if predictions or heard:
            taxonomy_top = [
                f"{p.species}={p.confidence:.4f}" for p in (predictions[:3] + heard[:3])
            ]
            logger.info("Perch returned (sound taxonomy): %s", ", ".join(taxonomy_top))
        else:
            logger.warning(
                "Perch returned no sound-taxonomy species above thresholds "
                "(heard_min=%.2f, pred_min=%.2f)",
                settings.audio_heard_min_confidence,
                settings.min_confidence,
            )

        return predictions, heard
