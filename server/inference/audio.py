from schemas import Prediction
from config import settings
from inference.mock_data import mock_predictions


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

    def predict(self, audio_bytes: bytes) -> list[Prediction]:
        if self.mock:
            rows = mock_predictions(settings.top_k)
            return [
                Prediction(species=c, scientific_name=s, confidence=conf)
                for c, s, conf in rows
            ]
        if not self.loaded or self._infer is None:
            raise RuntimeError("Audio model is not loaded")
        return self._predict(audio_bytes)

    def _decode_audio(self, audio_bytes: bytes):
        import io
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
            )
        finally:
            tmp_path.unlink(missing_ok=True)

        return np.asarray(waveform, dtype=np.float32)

    def _predict(self, audio_bytes: bytes) -> list[Prediction]:
        import numpy as np
        import tensorflow as tf

        from inference.label_utils import label_to_names

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
        aggregate: np.ndarray | None = None

        for chunk in windows:
            tensor = tf.constant(chunk.reshape(1, -1), dtype=tf.float32)
            outputs = self._infer(**{input_key: tensor})
            logits = outputs.get("label")
            if logits is None:
                logits = next(iter(outputs.values()))
            probs = tf.nn.softmax(logits[0]).numpy()
            aggregate = probs if aggregate is None else aggregate + probs

        if aggregate is None:
            raise ValueError("Could not analyze audio.")

        aggregate /= len(windows)
        order = np.argsort(aggregate)[::-1]

        predictions: list[Prediction] = []
        for idx in order:
            conf = float(aggregate[idx])
            if conf < settings.min_confidence and predictions:
                break
            if len(predictions) >= settings.top_k:
                break

            idx_int = int(idx)
            label = self._labels.get(idx_int, f"class_{idx_int}")
            species, scientific = label_to_names(label, class_idx=idx_int)
            predictions.append(
                Prediction(
                    species=species,
                    scientific_name=scientific,
                    confidence=round(conf, 4),
                )
            )

        if not predictions and len(order) > 0:
            idx_int = int(order[0])
            label = self._labels.get(idx_int, f"class_{idx_int}")
            species, scientific = label_to_names(label, class_idx=idx_int)
            predictions.append(
                Prediction(
                    species=species,
                    scientific_name=scientific,
                    confidence=round(float(aggregate[idx_int]), 4),
                )
            )

        return predictions
