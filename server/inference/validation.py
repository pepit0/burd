"""Photo authenticity checks — optional, controlled by IMAGE_VALIDATION_ENABLED."""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from config import settings
from schemas import Prediction, ValidationCheck, ValidationResult

logger = logging.getLogger(__name__)


@dataclass
class _Check:
    id: str
    passed: bool
    score: float
    message: str

    def to_schema(self) -> ValidationCheck:
        return ValidationCheck(
            id=self.id,
            passed=self.passed,
            score=round(self.score, 4),
            message=self.message,
        )


def validate_image(
    image_bytes: bytes,
    predictions: list[Prediction],
) -> ValidationResult:
    if not settings.image_validation_enabled:
        return ValidationResult(enabled=False, passed=True, checks=[])

    checks: list[_Check] = [
        _check_bird_confidence(predictions),
        _check_species_margin(predictions),
    ]

    try:
        checks.append(_check_recapture(image_bytes))
    except Exception:
        logger.exception("Recapture check failed; skipping")
        checks.append(
            _Check(
                id="recapture",
                passed=True,
                score=0.0,
                message="Recapture check unavailable.",
            )
        )

    passed = all(c.passed for c in checks)
    return ValidationResult(
        enabled=True,
        passed=passed,
        checks=[c.to_schema() for c in checks],
    )


def _check_bird_confidence(predictions: list[Prediction]) -> _Check:
    top = predictions[0].confidence if predictions else 0.0
    threshold = settings.validation_min_bird_confidence
    passed = top >= threshold
    return _Check(
        id="bird_confidence",
        passed=passed,
        score=top,
        message=(
            "Bird confidence looks good."
            if passed
            else f"No bird detected with enough confidence ({top:.0%} < {threshold:.0%}). "
            "Try a clearer photo of a live bird."
        ),
    )


def _check_species_margin(predictions: list[Prediction]) -> _Check:
    if len(predictions) < 2:
        return _Check(
            id="species_margin",
            passed=True,
            score=1.0,
            message="Single prediction — margin check skipped.",
        )

    margin = predictions[0].confidence - predictions[1].confidence
    threshold = settings.validation_min_species_margin
    passed = margin >= threshold
    return _Check(
        id="species_margin",
        passed=passed,
        score=margin,
        message=(
            "Species identification looks decisive."
            if passed
            else f"Uncertain identification (margin {margin:.0%} < {threshold:.0%}). "
            "The photo may not contain a bird."
        ),
    )


def _check_recapture(image_bytes: bytes) -> _Check:
    """Heuristic score for photos of screens, prints, or other re-photographed media."""
    import numpy as np
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    width, height = image.size
    side = 256
    resized = image.resize((side, side))
    gray = np.asarray(resized.convert("L"), dtype=np.float32)

    # Periodic high-frequency energy (moiré from screens / printed halftone).
    spectrum = np.fft.fftshift(np.abs(np.fft.fft2(gray - gray.mean())))
    center = side // 2
    y, x = np.ogrid[:side, :side]
    radius = np.sqrt((x - center) ** 2 + (y - center) ** 2)
    ring = (radius > side * 0.12) & (radius < side * 0.45)
    total = float(spectrum.sum()) + 1e-6
    moire_ratio = float(spectrum[ring].sum()) / total

    # Rectangular bezel / frame: strong edges along image border vs interior.
    gx = np.abs(np.diff(gray, axis=1)).mean()
    gy = np.abs(np.diff(gray, axis=0)).mean()
    border = max(8, side // 16)
    frame = np.concatenate(
        [
            gray[:border, :].ravel(),
            gray[-border:, :].ravel(),
            gray[:, :border].ravel(),
            gray[:, -border:].ravel(),
        ]
    )
    interior = gray[border:-border, border:-border].ravel()
    frame_contrast = abs(float(frame.mean()) - float(interior.mean())) / 255.0
    edge_strength = float(gx + gy) / 255.0

    # Low dynamic range often appears in flat screen photos.
    dynamic_range = (float(gray.max()) - float(gray.min())) / 255.0

    aspect = max(width, height) / max(min(width, height), 1)
    portrait_phone = 1.0 if aspect > 1.55 else 0.0

    score = min(
        1.0,
        moire_ratio * 2.4
        + frame_contrast * 0.9
        + max(0.0, 0.35 - dynamic_range) * 1.2
        + edge_strength * 0.15
        + portrait_phone * 0.08,
    )

    threshold = settings.validation_max_recapture_score
    passed = score <= threshold
    return _Check(
        id="recapture",
        passed=passed,
        score=score,
        message=(
            "Photo looks like an original capture."
            if passed
            else "This looks like a photo of a screen or printed image. "
            "Please photograph a live bird in the field."
        ),
    )
