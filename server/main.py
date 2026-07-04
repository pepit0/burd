from contextlib import asynccontextmanager
from datetime import datetime
import asyncio
import logging

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from schemas import HealthResponse, IdentifyResponse, ModelStatus, NativeLogit


def _configure_logging() -> None:
    """Ensure app loggers (inference.*, main) print alongside uvicorn access logs."""
    level = logging.DEBUG if settings.audio_debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(levelname)s     %(name)s: %(message)s",
        force=True,
    )
    for name in ("main", "inference", "inference.audio", "inference.regional"):
        logging.getLogger(name).setLevel(level)
    # Perch runs TensorFlow — keep TF chatter out of the console unless debugging.
    logging.getLogger("tensorflow").setLevel(logging.ERROR)


_configure_logging()

from inference.image import ImageClassifier
from inference.audio import AudioClassifier
from inference.regional import (
    boost_checklist_congener_substitutes,
    boost_corvid_mimic_substitutes,
    disambiguate_checklist_congeners,
    expand_live_sound_candidates,
    filter_and_rank_predictions,
    parse_context,
    perch_species_keys,
    prune_mimic_confusers_for_jay,
    rank_by_acoustic_geo,
    redirect_exotic_confusers_to_jay,
    resolve_corvid_confusion,
    _dedupe_predictions,
)
from inference.validation import validate_image

image_classifier = ImageClassifier()
audio_classifier = AudioClassifier()
logger = logging.getLogger(__name__)

# Serialize heavy inference: the Fly machine has ~1-2 shared CPUs and 2GB RAM.
# Running multiple birder/Perch passes at once (live sound sends many chunks)
# thrashes CPU and risks OOM, so nothing completes. One at a time is faster.
_inference_lock = asyncio.Semaphore(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    image_classifier.load()
    try:
        audio_classifier.load()
    except Exception as exc:
        # Perch/TensorFlow can OOM or fail on small VMs — keep photo ID up.
        logger.error(
            "Audio model failed to load (sound ID unavailable): %s",
            exc,
            exc_info=True,
        )

    # Warm up models so the first user request doesn't pay JIT/compile cost.
    for name, clf in (("image", image_classifier), ("audio", audio_classifier)):
        try:
            await asyncio.to_thread(clf.warmup)
            logger.info("Warmed up %s model", name)
        except Exception as exc:
            logger.warning("%s warmup skipped: %s", name, exc)

    yield


app = FastAPI(title="Burd Inference API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_BYTES = 15 * 1024 * 1024  # 15 MB


def _parse_optional_float(value: str | None) -> float | None:
    if value is None or not str(value).strip():
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _apply_regional_filter(
    predictions: list,
    heard: list,
    latitude: str | None,
    longitude: str | None,
    observed_at: str | None,
    *,
    strict: bool = False,
    max_results: int | None = None,
):
    lat = _parse_optional_float(latitude)
    lng = _parse_optional_float(longitude)
    ctx = parse_context(lat, lng, observed_at)
    combined = _dedupe_predictions(list(predictions) + list(heard))
    preds, applied_preds = filter_and_rank_predictions(
        predictions,
        ctx,
        strict=strict,
        max_results=max_results,
        candidate_pool=combined,
    )
    heard_filtered, applied_heard = filter_and_rank_predictions(
        heard,
        ctx,
        strict=strict,
        max_results=max_results,
        candidate_pool=combined,
    )
    return preds, heard_filtered, applied_preds or applied_heard


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        ok=True,
        mock=settings.inference_mock,
        image=ModelStatus(**image_classifier.status()),
        audio=ModelStatus(**audio_classifier.status()),
    )


@app.post("/identify/image", response_model=IdentifyResponse)
async def identify_image(
    image: UploadFile = File(...),
    latitude: str | None = Form(default=None),
    longitude: str | None = Form(default=None),
    observed_at: str | None = Form(default=None),
    live_photo: str | None = Form(default=None),
    skip_validation: str | None = Form(default=None),
) -> IdentifyResponse:
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image upload")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")
    try:
        async with _inference_lock:
            preds, count = await asyncio.to_thread(image_classifier.predict, data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    validation = validate_image(data, preds)
    bypass_validation = _parse_form_bool(live_photo) or _parse_form_bool(skip_validation)
    if validation.enabled and not validation.passed and not bypass_validation:
        failed = [c.message for c in validation.checks if not c.passed]
        raise HTTPException(
            status_code=422,
            detail={
                "message": failed[0] if failed else "Photo did not pass validation.",
                "validation": validation.model_dump(),
            },
        )
    preds, _, regional_applied = _apply_regional_filter(
        preds,
        [],
        latitude,
        longitude,
        observed_at or datetime.utcnow().isoformat(),
    )
    return IdentifyResponse(
        predictions=preds,
        count=count,
        model=image_classifier.model_name,
        mock=image_classifier.mock,
        validation=validation,
        regional_context_applied=regional_applied,
    )


def _parse_form_bool(value: str | None) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _parse_live_sound(value: str | None) -> bool:
    return _parse_form_bool(value)


@app.post("/identify/audio", response_model=IdentifyResponse)
async def identify_audio(
    audio: UploadFile = File(...),
    latitude: str | None = Form(default=None),
    longitude: str | None = Form(default=None),
    observed_at: str | None = Form(default=None),
    live_sound: str | None = Form(default=None),
) -> IdentifyResponse:
    is_live = _parse_live_sound(live_sound)
    data = await audio.read()
    logger.info(
        "POST /identify/audio live=%s filename=%r bytes=%d lat=%r lng=%r",
        is_live,
        audio.filename,
        len(data),
        latitude,
        longitude,
    )
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio upload")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Audio too large")
    try:
        async with _inference_lock:
            preds, heard = await asyncio.to_thread(
                audio_classifier.predict, data, live=is_live
            )
    except Exception as exc:
        logger.exception("Audio identify failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    raw_preds = list(preds)
    raw_heard = list(heard)
    if settings.audio_debug:
        logger.info(
            "Sound debug raw Perch: preds=%s heard=%s",
            ", ".join(
                f"{p.scientific_name or p.species}={p.confidence:.4f}"
                for p in raw_preds[:10]
            )
            or "(none)",
            ", ".join(
                f"{p.scientific_name or p.species}={p.confidence:.4f}"
                for p in raw_heard[:10]
            )
            or "(none)",
        )
        if audio_classifier._last_mean_probs is not None:
            from inference.sound_taxonomy import class_index_for_scientific

            mean_probs = audio_classifier._last_mean_probs
            mean_logits = audio_classifier._last_mean_logits
            for watch in (
                "cyanocitta cristata",
                "turdus migratorius",
                "corvus brachyrhynchos",
                "corvus corax",
                "corvus bennetti",
                "corvus capensis",
            ):
                idx = class_index_for_scientific(watch)
                if idx is None or idx >= len(mean_probs):
                    logger.info("Sound debug watch: %s — not in taxonomy index", watch)
                    continue
                logit = (
                    float(mean_logits[idx])
                    if mean_logits is not None and idx < len(mean_logits)
                    else float("nan")
                )
                logger.info(
                    "Sound debug watch: %s mean_prob=%.4f logit=%.3f",
                    watch,
                    float(mean_probs[idx]),
                    logit,
                )

    lat = _parse_optional_float(latitude)
    lng = _parse_optional_float(longitude)
    ctx = parse_context(lat, lng, observed_at or datetime.utcnow().isoformat())
    if ctx is None:
        logger.warning(
            "Audio identify without GPS — regional ranking disabled (lat=%r lng=%r)",
            latitude,
            longitude,
        )
    elif audio_classifier._last_mean_probs is not None:
        make_pred = lambda idx, conf: audio_classifier._prediction_from_index(idx, conf)
        raw_perch_keys = perch_species_keys(preds, heard)
        preds, heard = expand_live_sound_candidates(
            preds,
            heard,
            audio_classifier._last_mean_probs,
            make_pred,
            ctx,
            mean_logits=audio_classifier._last_mean_logits,
            raw_perch_keys=raw_perch_keys,
        )
        preds, heard = boost_checklist_congener_substitutes(
            preds,
            heard,
            audio_classifier._last_mean_probs,
            make_pred,
            ctx,
        )
        preds, heard = boost_corvid_mimic_substitutes(
            preds,
            heard,
            audio_classifier._last_mean_probs,
            make_pred,
            ctx,
        )
        preds, heard = resolve_corvid_confusion(
            preds,
            heard,
            audio_classifier._last_mean_probs,
            make_pred,
            ctx,
            audio_classifier._last_mean_logits,
            raw_perch_keys=raw_perch_keys,
        )
        preds, heard = redirect_exotic_confusers_to_jay(
            preds,
            heard,
            audio_classifier._last_mean_probs,
            make_pred,
            ctx,
            mean_logits=audio_classifier._last_mean_logits,
        )
        if audio_classifier._last_mean_logits is not None:
            preds, heard = prune_mimic_confusers_for_jay(
                preds,
                heard,
                ctx,
                audio_classifier._last_mean_logits,
                raw_perch_keys=raw_perch_keys,
            )
            preds, heard = disambiguate_checklist_congeners(
                preds,
                heard,
                ctx,
                audio_classifier._last_mean_logits,
                raw_perch_keys=raw_perch_keys,
            )

    preds, heard, regional_applied = _apply_regional_filter(
        preds,
        heard,
        latitude,
        longitude,
        observed_at or datetime.utcnow().isoformat(),
        strict=True,
        max_results=settings.audio_live_max_results,
    )

    if ctx is not None and audio_classifier._last_mean_logits is not None:
        preds = rank_by_acoustic_geo(preds, ctx, audio_classifier._last_mean_logits)
        heard = rank_by_acoustic_geo(heard, ctx, audio_classifier._last_mean_logits)

    if is_live and ctx is not None and audio_classifier._last_mean_logits is not None:
        merged = _dedupe_predictions(preds + heard)
        merged = rank_by_acoustic_geo(merged, ctx, audio_classifier._last_mean_logits)
        merged = merged[: settings.audio_live_max_results]
        preds = merged[:3]
        heard = merged

    if ctx and (preds or heard):
        combined = _dedupe_predictions(preds + heard)
        logger.info(
            "Audio regional top-3: %s (pool=%d, lat=%.4f lng=%.4f)",
            ", ".join(f"{p.species}={p.confidence:.4f}" for p in combined[:3]),
            len(combined),
            ctx.lat,
            ctx.lng,
        )

    if settings.audio_debug:
        combined = _dedupe_predictions(preds + heard)
        logger.info(
            "Sound debug final: %s (species=%d)",
            ", ".join(
                f"{p.scientific_name or p.species}={p.confidence:.4f}"
                for p in combined[:10]
            )
            or "(none)",
            len(combined),
        )

    native_logits: list[NativeLogit] = []
    if ctx is not None and audio_classifier._last_mean_logits is not None:
        from inference.checklist import checklist_species_for_coords
        from inference.sound_taxonomy import class_index_for_scientific

        mean_logits = audio_classifier._last_mean_logits
        for species in checklist_species_for_coords(ctx.lat, ctx.lng, ctx.month):
            class_idx = class_index_for_scientific(species)
            if class_idx is None or class_idx >= len(mean_logits):
                continue
            native_logits.append(
                NativeLogit(species_code=species, logit=float(mean_logits[class_idx]))
            )

    return IdentifyResponse(
        predictions=preds,
        heard_species=heard,
        model=audio_classifier.model_name,
        mock=audio_classifier.mock,
        regional_context_applied=regional_applied,
        native_logits=native_logits,
    )
