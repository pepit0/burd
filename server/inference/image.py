import io
import logging
from typing import Any

from config import settings
from inference.label_utils import label_to_names
from inference.licenses import get_model_license_info
from inference.mock_data import mock_predictions
from schemas import Prediction

logger = logging.getLogger(__name__)


class ImageClassifier:
    """Bird species classification from a photo using birder."""

    def __init__(self) -> None:
        self.mock = settings.inference_mock
        self.weights = settings.resolved_image_weights()
        self.model_name = self.weights
        self._license = get_model_license_info(self.weights)
        self._net = None
        self._transform = None
        self._device = None
        self._idx_to_label: dict[int, str] = {}
        self.loaded = False
        self.load_error: str | None = None
        self.num_classes: int | None = None

    def load(self) -> None:
        if self.mock:
            self.loaded = False
            self.load_error = None
            return
        try:
            self._load()
            self.loaded = True
            self.load_error = None
            logger.info(
                "Loaded birder weights=%s classes=%s device=%s",
                self.weights,
                self.num_classes,
                self._device,
            )
        except Exception as exc:
            self.loaded = False
            self.load_error = str(exc)
            logger.exception("Failed to load birder model %s", self.weights)
            raise

    def _load(self) -> None:
        import birder  # noqa: F401 — ensures package is installed
        import torch

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        net, model_info, transform = birder.load_pretrained_model_and_transform(
            self.weights,
            inference=True,
            device=device,
            progress_bar=True,
        )
        self._net = net
        self._transform = transform
        self._device = device
        self._idx_to_label = {v: k for k, v in model_info.class_to_idx.items()}
        self.num_classes = len(model_info.class_to_idx)

    def status(self) -> dict[str, Any]:
        return {
            "loaded": self.loaded,
            "mock": self.mock,
            "weights": self.weights,
            "code_license": "Apache-2.0",
            "weights_license": self._license.get("weights_license"),
            "commercial_status": self._license.get("commercial_status"),
            "license_note": self._license.get("note"),
            "num_classes": self.num_classes,
            "load_error": self.load_error,
        }

    def predict(self, image_bytes: bytes) -> tuple[list[Prediction], int]:
        if self.mock:
            rows = mock_predictions(settings.top_k)
            preds = [
                Prediction(species=c, scientific_name=s, confidence=conf)
                for c, s, conf in rows
            ]
            return preds, 1
        if not self.loaded or self._net is None or self._transform is None:
            raise RuntimeError("Image model is not loaded")
        preds, top_idx = self._predict(image_bytes)
        count = self._count_instances(image_bytes, top_idx) if top_idx is not None else 1
        return preds, count

    def _count_instances(self, image_bytes: bytes, class_idx: int) -> int:
        """Estimate bird count by scanning image regions for the top species."""
        import numpy as np
        from PIL import Image
        from birder.inference.classification import infer_image

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        width, height = image.size
        grid = 3
        threshold = max(settings.min_confidence, 0.25)
        match_cells: set[tuple[int, int]] = set()

        for row in range(grid):
            for col in range(grid):
                x0 = col * width // grid
                y0 = row * height // grid
                x1 = (col + 1) * width // grid if col < grid - 1 else width
                y1 = (row + 1) * height // grid if row < grid - 1 else height
                if x1 - x0 < 80 or y1 - y0 < 80:
                    continue

                patch = image.crop((x0, y0, x1, y1))
                probs, _ = infer_image(
                    self._net,
                    patch,
                    self._transform,
                    device=self._device,
                )
                patch_probs = probs[0]
                top_idx = int(np.argmax(patch_probs))
                if top_idx == class_idx and float(patch_probs[class_idx]) >= threshold:
                    match_cells.add((row, col))

        if not match_cells:
            return 1

        visited: set[tuple[int, int]] = set()
        components = 0
        for cell in match_cells:
            if cell in visited:
                continue
            components += 1
            stack = [cell]
            while stack:
                r, c = stack.pop()
                if (r, c) in visited or (r, c) not in match_cells:
                    continue
                visited.add((r, c))
                stack.extend([(r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)])

        return max(1, min(components, 99))

    def _predict(self, image_bytes: bytes) -> tuple[list[Prediction], int | None]:
        import numpy as np
        from PIL import Image
        from birder.inference.classification import infer_image

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        probs, _ = infer_image(
            self._net,
            image,
            self._transform,
            device=self._device,
        )
        row = probs[0]
        order = np.argsort(row)[::-1]
        top_idx: int | None = int(order[0]) if len(order) > 0 else None

        predictions: list[Prediction] = []
        for idx in order:
            conf = float(row[idx])
            if conf < settings.min_confidence and predictions:
                break
            if len(predictions) >= settings.top_k:
                break

            idx_int = int(idx)
            label = self._idx_to_label.get(idx_int, f"class_{idx_int}")
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
            label = self._idx_to_label.get(idx_int, f"class_{idx_int}")
            species, scientific = label_to_names(label, class_idx=idx_int)
            predictions.append(
                Prediction(
                    species=species,
                    scientific_name=scientific,
                    confidence=round(float(row[idx_int]), 4),
                )
            )

        return predictions, top_idx
