"""Live audio pooling tests."""

import numpy as np
import pytest

from config import settings
from inference.audio import AudioClassifier
from inference.sound_taxonomy import class_index_for_scientific
from schemas import Prediction


def test_heard_species_surfaces_more_with_max_than_mean_probs():
    """Brief call in one window: max-pool should score higher than mean."""
    robin_idx = class_index_for_scientific("turdus migratorius")
    jay_idx = class_index_for_scientific("cyanocitta cristata")
    assert robin_idx is not None
    assert jay_idx is not None

    size = max(robin_idx, jay_idx) + 10
    probs_mean = np.zeros(size, dtype=np.float32)
    probs_mean[robin_idx] = 0.12
    probs_mean[jay_idx] = 0.03

    probs_max = np.zeros(size, dtype=np.float32)
    probs_max[robin_idx] = 0.12
    probs_max[jay_idx] = 0.09

    clf = AudioClassifier()
    clf._labels = {
        robin_idx: "turdus_migratorius",
        jay_idx: "cyanocitta_cristata",
    }
    heard_mean = clf._heard_species(probs_mean)
    heard_max = clf._heard_species(probs_max)

    assert len(heard_mean) == 1
    assert len(heard_max) == 2


@pytest.mark.skipif(not settings.inference_mock, reason="requires INFERENCE_MOCK=true")
def test_audio_predict_mock_accepts_live_flag():
    clf = AudioClassifier()
    preds, heard = clf.predict(b"RIFF", live=True)
    assert all(isinstance(p, Prediction) for p in preds)
    assert all(isinstance(p, Prediction) for p in heard)


def _corvid_ctx_and_logits(corax_logit: float, crow_logit: float):
    from inference.regional import parse_context, is_on_regional_checklist

    corax = class_index_for_scientific("corvus corax")
    crow = class_index_for_scientific("corvus brachyrhynchos")
    if corax is None or crow is None:
        pytest.skip("corvid taxonomy unavailable")
    ctx = parse_context(53.55, -113.49, "2026-06-28T12:00:00")  # Edmonton
    if ctx is None:
        pytest.skip("no regional context")
    if not (
        is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, "corvus corax")
        and is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, "corvus brachyrhynchos")
    ):
        pytest.skip("corvids not on local checklist (regional data unavailable)")
    size = max(corax, crow) + 5
    logits = np.full(size, -5.0, dtype=np.float32)
    logits[corax] = corax_logit
    logits[crow] = crow_logit
    return ctx, logits


def _corvid_predictions():
    return [
        Prediction(species="Common Raven", scientific_name="corvus corax", confidence=0.08),
        Prediction(species="American Crow", scientific_name="corvus brachyrhynchos", confidence=0.10),
    ]


def test_disambiguate_drops_trailing_crow_for_clear_raven(monkeypatch):
    from inference.regional import disambiguate_checklist_congeners

    monkeypatch.setattr(settings, "audio_common_raven_logit_bias", 0.0)
    ctx, logits = _corvid_ctx_and_logits(corax_logit=7.0, crow_logit=4.0)
    preds, heard = disambiguate_checklist_congeners(
        _corvid_predictions(), _corvid_predictions(), ctx, logits
    )
    names = {(p.scientific_name or "").lower() for p in preds}
    assert "corvus corax" in names
    assert "corvus brachyrhynchos" not in names


def test_disambiguate_keeps_both_when_acoustically_close(monkeypatch):
    from inference.regional import disambiguate_checklist_congeners

    monkeypatch.setattr(settings, "audio_common_raven_logit_bias", 0.0)
    ctx, logits = _corvid_ctx_and_logits(corax_logit=6.5, crow_logit=6.0)
    preds, heard = disambiguate_checklist_congeners(
        _corvid_predictions(), _corvid_predictions(), ctx, logits
    )
    names = {(p.scientific_name or "").lower() for p in preds}
    assert "corvus corax" in names
    assert "corvus brachyrhynchos" in names


def test_disambiguate_never_drops_genuine_perch_hit(monkeypatch):
    """A real Perch detection of the trailing congener must survive disambiguation."""
    from inference.regional import disambiguate_checklist_congeners

    monkeypatch.setattr(settings, "audio_common_raven_logit_bias", 0.0)
    ctx, logits = _corvid_ctx_and_logits(corax_logit=7.0, crow_logit=4.0)
    preds, heard = disambiguate_checklist_congeners(
        _corvid_predictions(),
        _corvid_predictions(),
        ctx,
        logits,
        raw_perch_keys={"corvus brachyrhynchos"},
    )
    names = {(p.scientific_name or "").lower() for p in preds}
    assert "corvus brachyrhynchos" in names


def test_raven_bias_lets_crow_outrank_raven(monkeypatch):
    """With calibration, a crow call (crow logit > calibrated raven logit) ranks crow first."""
    from inference.regional import rank_by_acoustic_geo

    monkeypatch.setattr(settings, "audio_common_raven_logit_bias", 3.0)
    # Crow call: raven logit still nominally higher, but calibration (−3) flips it.
    ctx, logits = _corvid_ctx_and_logits(corax_logit=5.0, crow_logit=4.0)
    ranked = rank_by_acoustic_geo(_corvid_predictions(), ctx, logits)
    assert (ranked[0].scientific_name or "").lower() == "corvus brachyrhynchos"


def _corvid_ctx():
    from inference.regional import parse_context, is_on_regional_checklist

    for name in ("corvus bennetti", "corvus corax", "corvus brachyrhynchos"):
        if class_index_for_scientific(name) is None:
            pytest.skip("corvid taxonomy unavailable")
    ctx = parse_context(53.5426, -113.5061, "2026-06-28T12:00:00")  # Edmonton
    if ctx is None:
        pytest.skip("no regional context")
    if not (
        is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, "corvus corax")
        and is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, "corvus brachyrhynchos")
    ):
        pytest.skip("corvids not on local checklist (regional data unavailable)")
    return ctx


def _probs_for(values: dict[str, float]):
    indices = {k: class_index_for_scientific(k) for k in values}
    size = max(indices.values()) + 5
    probs = np.zeros(size, dtype=np.float32)
    for key, conf in values.items():
        probs[indices[key]] = conf
    return probs


def _logits_for(values: dict[str, float]):
    indices = {k: class_index_for_scientific(k) for k in values}
    size = max(indices.values()) + 5
    logits = np.full(size, -5.0, dtype=np.float32)
    for key, logit in values.items():
        logits[indices[key]] = logit
    return logits


def _make_pred(idx, conf):
    return Prediction(species=str(idx), scientific_name=str(idx), confidence=conf)


def test_corvid_resolver_picks_crow_when_native_crow_logit_leads(monkeypatch):
    """A crow call (calibrated raven logit ≥ crow logit) must resolve to American Crow."""
    from inference.regional import resolve_corvid_confusion

    monkeypatch.setattr(settings, "audio_common_raven_logit_bias", 4.5)
    ctx = _corvid_ctx()
    probs = _probs_for({"corvus capensis": 0.49, "corvus corax": 0.001, "corvus brachyrhynchos": 0.0})
    logits = _logits_for({"corvus corax": 7.5, "corvus brachyrhynchos": 2.0})
    injected = [
        Prediction(species="American Crow", scientific_name="corvus brachyrhynchos", confidence=0.28),
        Prediction(species="Common Raven", scientific_name="corvus corax", confidence=0.28),
    ]
    preds, heard = resolve_corvid_confusion(
        list(injected), list(injected), probs, _make_pred, ctx, logits,
        raw_perch_keys={"corvus capensis"},
    )
    names = {(p.scientific_name or "").lower() for p in preds}
    assert "corvus brachyrhynchos" in names
    assert "corvus corax" not in names


def test_corvid_resolver_keeps_raven_when_native_raven_logit_leads(monkeypatch):
    """A raven call (calibrated raven logit < crow logit) stays raven; spurious crow dropped."""
    from inference.regional import resolve_corvid_confusion

    monkeypatch.setattr(settings, "audio_common_raven_logit_bias", 4.5)
    ctx = _corvid_ctx()
    probs = _probs_for({"corvus bennetti": 0.49, "corvus corax": 0.002, "corvus brachyrhynchos": 0.0})
    logits = _logits_for({"corvus corax": 5.0, "corvus brachyrhynchos": 2.0})
    injected = [
        Prediction(species="Common Raven", scientific_name="corvus corax", confidence=0.28),
        Prediction(species="American Crow", scientific_name="corvus brachyrhynchos", confidence=0.28),
    ]
    preds, heard = resolve_corvid_confusion(
        list(injected), list(injected), probs, _make_pred, ctx, logits,
        raw_perch_keys={"corvus bennetti"},
    )
    names = {(p.scientific_name or "").lower() for p in preds}
    assert "corvus corax" in names
    assert "corvus brachyrhynchos" not in names


def test_corvid_resolver_noop_without_corvid_signal():
    """Weak corvid noise (e.g. on a jay clip) must not trigger a corvid override."""
    from inference.regional import resolve_corvid_confusion

    ctx = _corvid_ctx()
    probs = _probs_for(
        {"corvus corax": 0.05, "corvus brachyrhynchos": 0.04, "corvus bennetti": 0.03}
    )
    logits = _logits_for({"corvus corax": 2.0, "corvus brachyrhynchos": 1.0})
    jay = [Prediction(species="Blue Jay", scientific_name="cyanocitta cristata", confidence=0.3)]
    preds, heard = resolve_corvid_confusion(
        list(jay), list(jay), probs, _make_pred, ctx, logits, raw_perch_keys=set()
    )
    names = {(p.scientific_name or "").lower() for p in preds}
    assert names == {"cyanocitta cristata"}
