"""Regional ranking tests for live sound ID."""

from inference.regional import (
    filter_and_rank_predictions,
    score_prediction,
    should_show_live_sound,
)
from schemas import Prediction


EDMONTON_LAT = 53.5461
EDMONTON_LNG = -113.4938


def _ctx():
    from inference.regional import parse_context

    return parse_context(EDMONTON_LAT, EDMONTON_LNG, "2026-06-15T12:00:00Z")


def test_edmonton_robin_ranks_above_blackbird():
    ctx = _ctx()
    robin = Prediction(
        species="American Robin",
        scientific_name="turdus migratorius",
        confidence=0.12,
    )
    blackbird = Prediction(
        species="Eurasian Blackbird",
        scientific_name="turdus merula",
        confidence=0.14,
    )

    assert should_show_live_sound(ctx, robin) is True
    assert should_show_live_sound(ctx, blackbird) is False

    ranked, filtered = filter_and_rank_predictions(
        [blackbird, robin],
        ctx,
        strict=True,
    )
    assert filtered is True
    assert len(ranked) >= 1
    assert ranked[0].scientific_name == "turdus migratorius"


def test_edmonton_geo_score_favors_robin():
    ctx = _ctx()
    robin = Prediction(
        species="American Robin",
        scientific_name="turdus migratorius",
        confidence=0.12,
    )
    blackbird = Prediction(
        species="Eurasian Blackbird",
        scientific_name="turdus merula",
        confidence=0.14,
    )

    assert score_prediction(ctx, robin) > score_prediction(ctx, blackbird)


def test_edmonton_blackbird_suppressed_when_robin_only_in_predictions():
    ctx = _ctx()
    robin = Prediction(
        species="American Robin",
        scientific_name="turdus migratorius",
        confidence=0.08,
    )
    blackbird = Prediction(
        species="Eurasian Blackbird",
        scientific_name="turdus merula",
        confidence=0.96,
    )
    combined = [blackbird, robin]

    assert should_show_live_sound(ctx, robin, combined) is True
    assert should_show_live_sound(ctx, blackbird, combined) is False


def test_edmonton_blackbird_suppressed_when_robin_in_pool():
    ctx = _ctx()
    robin = Prediction(
        species="American Robin",
        scientific_name="turdus migratorius",
        confidence=0.08,
    )
    blackbird = Prediction(
        species="Eurasian Blackbird",
        scientific_name="turdus merula",
        confidence=0.96,
    )
    pool = [blackbird, robin]

    assert should_show_live_sound(ctx, robin, pool) is True
    assert should_show_live_sound(ctx, blackbird, pool) is False


def test_pacific_nw_local_wren_beats_vagrant():
    from inference.regional import parse_context

    ctx = parse_context(47.6062, -122.3321, "2026-06-15T12:00:00Z")
    local = Prediction(
        species="Pacific Wren",
        scientific_name="troglodytes pacificus",
        confidence=0.11,
    )
    vagrant = Prediction(
        species="Eurasian Blackbird",
        scientific_name="turdus merula",
        confidence=0.16,
    )

    assert should_show_live_sound(ctx, local) is True
    assert should_show_live_sound(ctx, vagrant) is False


def test_southeast_local_cardinal_beats_vagrant():
    from inference.regional import parse_context

    ctx = parse_context(33.749, -84.388, "2026-06-15T12:00:00Z")
    local = Prediction(
        species="Northern Cardinal",
        scientific_name="cardinalis cardinalis",
        confidence=0.1,
    )
    vagrant = Prediction(
        species="Eurasian Blackbird",
        scientific_name="turdus merula",
        confidence=0.15,
    )

    assert should_show_live_sound(ctx, local) is True
    assert should_show_live_sound(ctx, vagrant) is False


def test_edmonton_cyanochen_blocked_at_moderate_confidence():
    ctx = _ctx()
    for confidence in (0.42, 0.96):
        cyanochen = Prediction(
            species="Blue-winged Goose",
            scientific_name="cyanochen cyanoptera",
            confidence=confidence,
        )
        assert should_show_live_sound(ctx, cyanochen) is False


def test_edmonton_blue_jay_on_checklist():
    ctx = _ctx()
    blue_jay = Prediction(
        species="Blue Jay",
        scientific_name="cyanocitta cristata",
        confidence=0.08,
    )

    assert should_show_live_sound(ctx, blue_jay) is True


def test_acoustic_geo_prefers_blue_jay_over_rough_legged_hawk():
    from inference.regional import native_acoustic_top_keys, rank_by_acoustic_geo
    from inference.sound_taxonomy import class_index_for_scientific

    ctx = _ctx()
    jay_idx = class_index_for_scientific("cyanocitta cristata")
    hawk_idx = class_index_for_scientific("buteo lagopus")
    assert jay_idx is not None
    assert hawk_idx is not None

    size = max(jay_idx, hawk_idx) + 5
    mean_logits = [-8.0] * size
    mean_logits[jay_idx] = 3.5
    mean_logits[hawk_idx] = 1.0

    acoustic_top = native_acoustic_top_keys(ctx, mean_logits, top_k=5)
    assert "cyanocitta cristata" in acoustic_top

    blue_jay = Prediction(
        species="Blue Jay",
        scientific_name="cyanocitta cristata",
        confidence=0.06,
    )
    rough_legged = Prediction(
        species="Rough-legged Hawk",
        scientific_name="buteo lagopus",
        confidence=0.18,
    )

    ranked = rank_by_acoustic_geo(
        [rough_legged, blue_jay],
        ctx,
        mean_logits,
    )
    assert ranked[0].scientific_name == "cyanocitta cristata"


def test_expand_skips_snowy_owl_at_low_checklist_noise():
    from inference.regional import expand_live_sound_candidates
    from inference.sound_taxonomy import class_index_for_scientific

    ctx = _ctx()
    robin_idx = class_index_for_scientific("turdus migratorius")
    owl_idx = class_index_for_scientific("bubo scandiacus")
    assert robin_idx is not None
    assert owl_idx is not None

    size = max(robin_idx, owl_idx) + 10
    mean_probs = [0.001] * size
    mean_logits = [-8.0] * size
    mean_probs[robin_idx] = 0.14
    mean_logits[robin_idx] = 3.0
    mean_probs[owl_idx] = 0.035
    mean_logits[owl_idx] = 0.5

    def make_pred(class_idx: int, conf: float) -> Prediction:
        if class_idx == robin_idx:
            return Prediction(
                species="American Robin",
                scientific_name="turdus migratorius",
                confidence=conf,
            )
        return Prediction(
            species="Snowy Owl",
            scientific_name="bubo scandiacus",
            confidence=conf,
        )

    preds, heard = expand_live_sound_candidates(
        [],
        [],
        mean_probs,
        make_pred,
        ctx,
        mean_logits=mean_logits,
        raw_perch_keys=set(),
    )
    keys = {p.scientific_name for p in preds + heard}
    assert "turdus migratorius" in keys
    assert "bubo scandiacus" not in keys


def test_corvid_mimic_boost_injects_blue_jay_when_owl_leads():
    from inference.regional import boost_corvid_mimic_substitutes
    from inference.sound_taxonomy import class_index_for_scientific

    ctx = _ctx()
    jay_idx = class_index_for_scientific("cyanocitta cristata")
    owl_idx = class_index_for_scientific("bubo scandiacus")
    assert jay_idx is not None
    assert owl_idx is not None

    size = max(jay_idx, owl_idx) + 10
    mean_probs = [0.001] * size
    mean_probs[jay_idx] = 0.04
    mean_probs[owl_idx] = 0.06

    owl = Prediction(
        species="Snowy Owl",
        scientific_name="bubo scandiacus",
        confidence=0.06,
    )

    def make_pred(class_idx: int, conf: float) -> Prediction:
        if class_idx == jay_idx:
            return Prediction(
                species="Blue Jay",
                scientific_name="cyanocitta cristata",
                confidence=conf,
            )
        return owl

    preds, heard = boost_corvid_mimic_substitutes(
        [owl],
        [],
        mean_probs,
        make_pred,
        ctx,
    )
    keys = {p.scientific_name for p in preds + heard}
    assert "cyanocitta cristata" in keys


def test_prune_mimic_confusers_drops_weak_owl_when_jay_competitive():
    from inference.regional import prune_mimic_confusers_for_jay
    from inference.sound_taxonomy import class_index_for_scientific

    ctx = _ctx()
    jay_idx = class_index_for_scientific("cyanocitta cristata")
    owl_idx = class_index_for_scientific("bubo scandiacus")
    assert jay_idx is not None
    assert owl_idx is not None

    size = max(jay_idx, owl_idx) + 10
    mean_logits = [-8.0] * size
    mean_logits[jay_idx] = 2.5
    mean_logits[owl_idx] = 3.0

    jay = Prediction(
        species="Blue Jay",
        scientific_name="cyanocitta cristata",
        confidence=0.06,
    )
    owl = Prediction(
        species="Snowy Owl",
        scientific_name="bubo scandiacus",
        confidence=0.05,
    )

    preds, heard = prune_mimic_confusers_for_jay(
        [jay, owl],
        [],
        ctx,
        mean_logits,
        raw_perch_keys=set(),
    )
    keys = {p.scientific_name for p in preds + heard}
    assert "cyanocitta cristata" in keys
    assert "bubo scandiacus" not in keys


def test_prune_keeps_raw_perch_hawk_when_jay_competitive():
    from inference.regional import prune_mimic_confusers_for_jay
    from inference.sound_taxonomy import class_index_for_scientific

    ctx = _ctx()
    jay_idx = class_index_for_scientific("cyanocitta cristata")
    hawk_idx = class_index_for_scientific("buteo lagopus")
    assert jay_idx is not None
    assert hawk_idx is not None

    size = max(jay_idx, hawk_idx) + 10
    mean_logits = [-8.0] * size
    mean_logits[jay_idx] = 2.5
    mean_logits[hawk_idx] = 3.0

    jay = Prediction(
        species="Blue Jay",
        scientific_name="cyanocitta cristata",
        confidence=0.06,
    )
    hawk = Prediction(
        species="Rough-legged Hawk",
        scientific_name="buteo lagopus",
        confidence=0.18,
    )

    preds, heard = prune_mimic_confusers_for_jay(
        [jay, hawk],
        [],
        ctx,
        mean_logits,
        raw_perch_keys={"buteo lagopus"},
    )
    keys = {p.scientific_name for p in preds + heard}
    assert "buteo lagopus" in keys
