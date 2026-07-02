"""Regional geo/season frequency priors for inference filtering."""

from __future__ import annotations

import math
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path

from config import settings
from inference.catalog import is_in_catalog
from inference.checklist import checklist_prior, has_checklist_data, is_on_regional_checklist
from schemas import Prediction

NA_BBOX = {"min_lat": 15, "max_lat": 72, "min_lng": -170, "max_lng": -50}
NA_GRID = 1
GLOBAL_GRID = 2

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "regional-priors"


@dataclass
class RegionalContext:
    lat: float
    lng: float
    date: datetime
    cell_id: str
    month: int
    bundle_region: str


def _is_in_na_bbox(lat: float, lng: float) -> bool:
    return (
        NA_BBOX["min_lat"] <= lat <= NA_BBOX["max_lat"]
        and NA_BBOX["min_lng"] <= lng <= NA_BBOX["max_lng"]
    )


def cell_id(lat: float, lng: float, grid_deg: float) -> str:
    lat_band = math.floor(lat / grid_deg) * grid_deg
    lng_band = math.floor(lng / grid_deg) * grid_deg
    return f"{int(lat_band)}_{int(lng_band)}"


def bundle_region_for_coords(lat: float, lng: float) -> str:
    return "na" if _is_in_na_bbox(lat, lng) else "global"


def grid_deg_for_coords(lat: float, lng: float) -> int:
    return NA_GRID if _is_in_na_bbox(lat, lng) else GLOBAL_GRID


@lru_cache(maxsize=2)
def _open_db(region: str) -> sqlite3.Connection | None:
    path = DATA_DIR / f"{region}.sqlite"
    if not path.is_file():
        return None
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def parse_context(
    lat: float | None,
    lng: float | None,
    observed_at: str | None,
) -> RegionalContext | None:
    if lat is None or lng is None:
        return None
    try:
        when = datetime.fromisoformat(observed_at.replace("Z", "+00:00")) if observed_at else datetime.utcnow()
    except ValueError:
        when = datetime.utcnow()
    region = bundle_region_for_coords(lat, lng)
    grid = grid_deg_for_coords(lat, lng)
    return RegionalContext(
        lat=lat,
        lng=lng,
        date=when,
        cell_id=cell_id(lat, lng, grid),
        month=when.month,
        bundle_region=region,
    )


def _normalize_scientific(name: str | None) -> str:
    if not name:
        return ""
    parts = name.strip().lower().replace("_", " ").split()
    if len(parts) < 2:
        return name.strip().lower()
    return f"{parts[0]} {parts[1]}"


def _neighbor_cell_ids(cell_id: str, grid_deg: int) -> list[str]:
    parts = cell_id.split("_", 1)
    if len(parts) != 2:
        return []
    try:
        lat = int(parts[0])
        lng = int(parts[1])
    except ValueError:
        return []

    neighbors: list[str] = []
    for d_lat in (-grid_deg, 0, grid_deg):
        for d_lng in (-grid_deg, 0, grid_deg):
            if d_lat == 0 and d_lng == 0:
                continue
            neighbors.append(f"{lat + d_lat}_{lng + d_lng}")
    return neighbors


def _max_freq_in_cell(
    conn: sqlite3.Connection,
    cell_id: str,
    scientific_name: str,
) -> float:
    row = conn.execute(
        """
        SELECT MAX(frequency) AS frequency FROM cell_priors
        WHERE cell_id = ? AND scientific_name = ?
        """,
        (cell_id, scientific_name),
    ).fetchone()
    return float(row["frequency"]) if row and row["frequency"] is not None else 0.0


def gbif_frequency(ctx: RegionalContext, scientific_name: str) -> float:
    conn = _open_db(ctx.bundle_region)
    if conn is None:
        return 0.0
    key = _normalize_scientific(scientific_name)
    if not key:
        return 0.0

    row = conn.execute(
        """
        SELECT frequency FROM cell_priors
        WHERE cell_id = ? AND month = ? AND scientific_name = ?
        """,
        (ctx.cell_id, ctx.month, key),
    ).fetchone()
    freq = float(row["frequency"]) if row else 0.0

    if freq > 0:
        return freq

    freq = _max_freq_in_cell(conn, ctx.cell_id, key)
    if freq > 0:
        return freq

    grid = grid_deg_for_coords(ctx.lat, ctx.lng)
    for neighbor_id in _neighbor_cell_ids(ctx.cell_id, grid):
        row = conn.execute(
            """
            SELECT frequency FROM cell_priors
            WHERE cell_id = ? AND month = ? AND scientific_name = ?
            """,
            (neighbor_id, ctx.month, key),
        ).fetchone()
        neighbor_freq = float(row["frequency"]) if row else 0.0
        if neighbor_freq > freq:
            freq = neighbor_freq

    if freq > 0:
        return freq

    for neighbor_id in _neighbor_cell_ids(ctx.cell_id, grid):
        neighbor_freq = _max_freq_in_cell(conn, neighbor_id, key)
        if neighbor_freq > freq:
            freq = neighbor_freq

    return freq


def geo_prior(ctx: RegionalContext, scientific_name: str) -> float:
    gbif = gbif_frequency(ctx, scientific_name)
    checklist = checklist_prior(ctx.lat, ctx.lng, ctx.month, scientific_name)
    return max(gbif, checklist)


def cell_has_gbif_data(ctx: RegionalContext) -> bool:
    conn = _open_db(ctx.bundle_region)
    if conn is None:
        return False
    grid = grid_deg_for_coords(ctx.lat, ctx.lng)
    cells = [ctx.cell_id, *_neighbor_cell_ids(ctx.cell_id, grid)]
    for cell in cells:
        row = conn.execute(
            "SELECT 1 FROM cell_priors WHERE cell_id = ? LIMIT 1",
            (cell,),
        ).fetchone()
        if row:
            return True
    return False


def is_species_expected(ctx: RegionalContext, scientific_name: str) -> bool:
    return geo_prior(ctx, scientific_name) >= settings.regional_min_expected_freq


def score_prediction(ctx: RegionalContext, prediction: Prediction) -> float:
    key = _normalize_scientific(prediction.scientific_name) or prediction.species.strip().lower()
    prior = geo_prior(ctx, key)
    eps = settings.regional_geo_epsilon
    alpha = settings.regional_geo_alpha
    return prediction.confidence * ((eps + prior) ** alpha)


def should_show(ctx: RegionalContext, prediction: Prediction) -> bool:
    key = _normalize_scientific(prediction.scientific_name) or prediction.species.strip().lower()
    prior = geo_prior(ctx, key)
    if prior >= settings.regional_min_expected_freq:
        return True
    return prediction.confidence >= settings.regional_vagrant_confidence


LIVE_SOUND_CATALOG_CONFIDENCE = 0.22

BLUE_JAY_KEY = "cyanocitta cristata"

# Exotic taxa Perch reliably (mis)classifies phone-recorded Blue Jay calls as.
# These cannot occur in North America, so a high-confidence hit there is always a
# misclassification — empirically a Blue Jay. Keep this list NA-impossible only.
JAY_EXOTIC_CONFUSERS = frozenset({"cyanochen cyanoptera"})

AMERICAN_CROW_KEY = "corvus brachyrhynchos"
COMMON_RAVEN_KEY = "corvus corax"

# Corvus species grouped by acoustic type. Perch confidently assigns NA corvids to the wrong
# *geographic* Corvus (e.g. an American Crow → Australian Little Crow) and ranks the
# cosmopolitan Common Raven above American Crow, but it does separate crow-type from
# raven-type calls. Aggregating Perch's votes by type lets us pick the right local species.
CROW_TYPE_CORVUS = frozenset(
    {
        "corvus brachyrhynchos",  # American Crow (NA target)
        "corvus bennetti",  # Little Crow (AU)
        "corvus capensis",  # Cape Crow (AF)
        "corvus ossifragus",  # Fish Crow
        "corvus splendens",  # House Crow
        "corvus corone",  # Carrion Crow
        "corvus cornix",  # Hooded Crow
        "corvus frugilegus",  # Rook
        "corvus orru",  # Torresian Crow
        "corvus macrorhynchos",  # Large-billed Crow
    }
)
RAVEN_TYPE_CORVUS = frozenset(
    {
        "corvus corax",  # Common Raven (NA target)
        "corvus cryptoleucus",  # Chihuahuan Raven
        "corvus crassirostris",  # Thick-billed Raven
        "corvus rhipidurus",  # Fan-tailed Raven
        "corvus albicollis",  # White-necked Raven
        "corvus ruficollis",  # Brown-necked Raven
        "corvus coronoides",  # Australian Raven
        "corvus mellori",  # Little Raven
        "corvus tasmanicus",  # Forest Raven
    }
)

HAWK_GENERA = frozenset(
    {
        "accipiter",
        "aquila",
        "buteo",
        "circus",
        "geranoaetus",
        "haliaeetus",
        "melierax",
        "milvus",
        "parabuteo",
    }
)

OWL_GENERA = frozenset(
    {
        "aegolius",
        "asio",
        "athene",
        "bubo",
        "megascops",
        "otus",
        "strix",
        "surnia",
        "tyto",
    }
)

FALCON_GENERA = frozenset({"falco", "micrastur", "herpetotheres"})

MIMIC_CONFUSER_GENERA = HAWK_GENERA | OWL_GENERA | FALCON_GENERA | frozenset({"corvus"})

RAPTOR_INJECTION_GENERA = MIMIC_CONFUSER_GENERA


def _species_key(prediction: Prediction) -> str:
    return _normalize_scientific(prediction.scientific_name) or prediction.species.strip().lower()


def _genus(scientific_name: str) -> str | None:
    parts = scientific_name.strip().lower().split()
    return parts[0] if parts else None


def perch_species_keys(
    predictions: list[Prediction],
    heard: list[Prediction],
) -> set[str]:
    """Species keys from raw Perch output (protected from mimic pruning)."""
    return {_species_key(p) for p in predictions + heard if _species_key(p)}


def _logit_for_key(key: str, mean_logits) -> float:
    from inference.sound_taxonomy import class_index_for_scientific

    if mean_logits is None or len(mean_logits) == 0:
        return float("-inf")
    class_idx = class_index_for_scientific(key)
    if class_idx is None or class_idx >= len(mean_logits):
        return float("-inf")
    return float(mean_logits[class_idx])


def _congener_logit_bias() -> dict[str, float]:
    """Per-class logit offsets that correct Perch's training-data imbalance between
    confusable congeners. Defaults to no-op; tune via config from AUDIO_DEBUG logits."""
    bias = settings.audio_common_raven_logit_bias
    return {"corvus corax": bias} if bias else {}


def _calibrated_logit_for_key(key: str, mean_logits) -> float:
    """Logit with congener calibration applied (raw logit when uncalibrated)."""
    logit = _logit_for_key(key, mean_logits)
    if logit == float("-inf"):
        return logit
    return logit - _congener_logit_bias().get(key, 0.0)


def native_logit_leader(
    ctx: RegionalContext,
    mean_logits,
) -> tuple[str, float] | None:
    from inference.checklist import checklist_species_for_coords

    if mean_logits is None or len(mean_logits) == 0:
        return None

    ranked: list[tuple[str, float]] = []
    for species in checklist_species_for_coords(ctx.lat, ctx.lng, ctx.month):
        logit = _logit_for_key(species, mean_logits)
        if logit == float("-inf"):
            continue
        ranked.append((species, logit))

    if not ranked:
        return None

    ranked.sort(key=lambda item: item[1], reverse=True)
    return ranked[0]


def _is_raptor_injection_genus(genus: str | None) -> bool:
    return genus is not None and genus in RAPTOR_INJECTION_GENERA


def _is_mimic_confuser_genus(genus: str | None) -> bool:
    return genus is not None and genus in MIMIC_CONFUSER_GENERA


def _should_inject_checklist_species(
    species: str,
    conf: float,
    raw_perch_keys: set[str],
) -> bool:
    genus = _genus(species)
    if not _is_raptor_injection_genus(genus):
        return True
    if species in raw_perch_keys:
        return True
    return conf >= settings.audio_raptor_injection_min_confidence


def _checklist_congener_in_pool(
    ctx: RegionalContext,
    genus: str,
    pool: list[Prediction],
    *,
    min_confidence: float,
) -> bool:
    for candidate in pool:
        key = _species_key(candidate)
        if _genus(key) != genus:
            continue
        if candidate.confidence < min_confidence:
            continue
        if is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, key):
            return True
        if is_species_expected(ctx, key):
            return True
    return False


def _in_sound_species_set(key: str) -> bool:
    if not key:
        return False
    try:
        from inference.sound_taxonomy import is_in_sound_taxonomy

        return is_in_sound_taxonomy(key)
    except ImportError:
        return is_in_catalog(key)


def should_show_live_sound(
    ctx: RegionalContext,
    prediction: Prediction,
    pool: list[Prediction] | None = None,
) -> bool:
    """Merlin-style: expected, on checklist, or high-confidence vagrant."""
    key = _species_key(prediction)
    if not _in_sound_species_set(key):
        return False
    if is_species_expected(ctx, key):
        return True
    if is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, key):
        return True

    candidates = pool if pool is not None else [prediction]
    genus = _genus(key)
    if genus and _checklist_congener_in_pool(
        ctx,
        genus,
        candidates,
        min_confidence=settings.audio_detection_min_confidence,
    ):
        return False

    prior = geo_prior(ctx, key)
    if prior < settings.regional_min_expected_freq:
        # Live sound: never surface off-checklist exotics with zero regional signal.
        return False
    return prediction.confidence >= settings.audio_vagrant_confidence


def _dedupe_predictions(predictions: list[Prediction]) -> list[Prediction]:
    seen: set[str] = set()
    out: list[Prediction] = []
    for prediction in predictions:
        key = _species_key(prediction)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(prediction)
    return out


def boost_checklist_congener_substitutes(
    predictions: list[Prediction],
    heard: list[Prediction],
    mean_probs,
    make_prediction,
    ctx: RegionalContext,
) -> tuple[list[Prediction], list[Prediction]]:
    """When Perch favors a wrong congener (Blackbird), inject the local checklist one (Robin)."""
    from collections import defaultdict

    from inference.checklist import checklist_species_for_coords
    from inference.sound_taxonomy import class_index_for_scientific

    checklist = checklist_species_for_coords(ctx.lat, ctx.lng, ctx.month)
    if not checklist:
        return predictions, heard

    pool = predictions + heard
    existing = {_species_key(p) for p in pool}
    heard_keys = {_species_key(p) for p in heard}
    off_checklist_by_genus: dict[str, list[Prediction]] = defaultdict(list)

    for prediction in pool:
        key = _species_key(prediction)
        genus = _genus(key)
        if not genus:
            continue
        if is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, key):
            continue
        if is_species_expected(ctx, key):
            continue
        off_checklist_by_genus[genus].append(prediction)

    for genus, wrong_hits in off_checklist_by_genus.items():
        if not wrong_hits:
            continue
        top_wrong = max(wrong_hits, key=lambda p: p.confidence)
        local_species = [
            species
            for species in checklist
            if _genus(species) == genus
            and (
                is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, species)
                or is_species_expected(ctx, species)
            )
        ]
        for species in local_species:
            if species in existing:
                continue
            class_idx = class_index_for_scientific(species)
            if class_idx is None:
                continue
            mean_conf = float(mean_probs[class_idx])
            boosted = max(
                mean_conf,
                top_wrong.confidence * 0.3,
                settings.audio_detection_min_confidence,
            )
            pred = make_prediction(class_idx, boosted)
            predictions.append(pred)
            existing.add(species)
            if species not in heard_keys:
                heard.append(pred)
                heard_keys.add(species)

    return predictions, heard


def expand_live_sound_candidates(
    predictions: list[Prediction],
    heard: list[Prediction],
    mean_probs,
    make_prediction,
    ctx: RegionalContext,
    mean_logits=None,
    *,
    raw_perch_keys: set[str] | None = None,
) -> tuple[list[Prediction], list[Prediction]]:
    """Inject acoustically competitive checklist species when Perch has a real signal."""
    from inference.checklist import checklist_species_for_coords
    from inference.sound_taxonomy import class_index_for_scientific

    checklist = checklist_species_for_coords(ctx.lat, ctx.lng, ctx.month)
    if not checklist:
        return predictions, heard

    perch_keys = raw_perch_keys or perch_species_keys(predictions, heard)
    leader = native_logit_leader(ctx, mean_logits)
    if not leader:
        return predictions, heard

    leader_key, leader_logit = leader
    existing = {_species_key(p) for p in predictions}
    heard_existing = {_species_key(p) for p in heard}
    scored: list[tuple[str, float, float, int]] = []
    scan_min = settings.audio_checklist_scan_min_confidence
    inject_min = settings.audio_checklist_injection_min_confidence
    margin = settings.audio_acoustic_logit_margin

    for species in checklist:
        class_idx = class_index_for_scientific(species)
        if class_idx is None or class_idx >= len(mean_probs):
            continue
        conf = float(mean_probs[class_idx])
        if conf < scan_min:
            continue
        logit = (
            float(mean_logits[class_idx])
            if mean_logits is not None and class_idx < len(mean_logits)
            else conf
        )
        scored.append((species, logit, conf, class_idx))

    scored.sort(key=lambda item: item[1], reverse=True)
    top_k = max(1, settings.audio_acoustic_native_top_k)
    injected = 0

    if leader_key not in existing:
        class_idx = class_index_for_scientific(leader_key)
        if class_idx is not None and class_idx < len(mean_probs):
            leader_prob = float(mean_probs[class_idx])
            if leader_prob >= scan_min and _should_inject_checklist_species(
                leader_key, leader_prob, perch_keys
            ):
                pred = make_prediction(class_idx, leader_prob)
                predictions.append(pred)
                existing.add(leader_key)
                if (
                    leader_key not in heard_existing
                    and leader_prob >= settings.audio_heard_min_confidence
                ):
                    heard.append(pred)
                    heard_existing.add(leader_key)

    for species, logit, conf, class_idx in scored:
        if injected >= top_k:
            break
        if species in existing:
            continue
        if logit < leader_logit - margin:
            continue
        min_conf = scan_min if species == leader_key else inject_min
        if conf < min_conf:
            continue
        if not _should_inject_checklist_species(species, conf, perch_keys):
            continue
        pred = make_prediction(class_idx, conf)
        predictions.append(pred)
        existing.add(species)
        injected += 1
        if species not in heard_existing and conf >= settings.audio_heard_min_confidence:
            heard.append(pred)
            heard_existing.add(species)

    return predictions, heard


def boost_corvid_mimic_substitutes(
    predictions: list[Prediction],
    heard: list[Prediction],
    mean_probs,
    make_prediction,
    ctx: RegionalContext,
) -> tuple[list[Prediction], list[Prediction]]:
    """When Perch favors hawk/owl/falcon mimic, inject local Blue Jay if acoustically plausible."""
    from inference.sound_taxonomy import class_index_for_scientific

    if not is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, BLUE_JAY_KEY):
        return predictions, heard

    jay_idx = class_index_for_scientific(BLUE_JAY_KEY)
    if jay_idx is None or jay_idx >= len(mean_probs):
        return predictions, heard

    jay_prob = float(mean_probs[jay_idx])
    if jay_prob < settings.audio_checklist_scan_min_confidence:
        return predictions, heard

    pool = predictions + heard
    confusers = [
        p
        for p in pool
        if _is_mimic_confuser_genus(_genus(_species_key(p)))
        and p.confidence >= settings.audio_detection_min_confidence
    ]
    if not confusers:
        return predictions, heard

    top_confuser = max(confusers, key=lambda p: p.confidence)
    existing = {_species_key(p) for p in pool}
    heard_keys = {_species_key(p) for p in heard}

    if BLUE_JAY_KEY in existing:
        return predictions, heard

    boosted = max(
        jay_prob,
        top_confuser.confidence * 0.4,
        settings.audio_detection_min_confidence,
    )
    pred = make_prediction(jay_idx, boosted)
    predictions.append(pred)
    if BLUE_JAY_KEY not in heard_keys:
        heard.append(pred)

    return predictions, heard


def resolve_corvid_confusion(
    predictions: list[Prediction],
    heard: list[Prediction],
    mean_probs,
    make_prediction,
    ctx: RegionalContext,
    mean_logits=None,
    *,
    raw_perch_keys: set[str],
) -> tuple[list[Prediction], list[Prediction]]:
    """Pick American Crow vs Common Raven from the genuine NA-class logits.

    Perch routes both NA corvids onto off-continent Corvus attractors (Little Crow, Cape Crow)
    and its raw raven logit runs hot, so neither the raw top label nor a raw corax/brachyrhynchos
    ranking is reliable — the generic congener booster injects both and everything lands on one
    species. The calibrated native pair still separates the two call types once the raven logit
    bias is applied; empirically the higher calibrated raven logit maps to American Crow and the
    lower to Common Raven (inverted from the initial AUDIO_DEBUG read). We gate on "is Perch
    hearing a Corvus at all" (any attractor above threshold), then pick the local species using
    that mapping, dropping the other only when it is a spurious (non-raw) congener substitute.
    NA + checklist scoped.
    """
    from inference.sound_taxonomy import class_index_for_scientific

    if ctx.bundle_region != "na":
        return predictions, heard
    if mean_logits is None or len(mean_logits) == 0:
        return predictions, heard

    crow_on = is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, AMERICAN_CROW_KEY)
    raven_on = is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, COMMON_RAVEN_KEY)
    if not (crow_on or raven_on):
        return predictions, heard

    # Gate: only act when Perch is confident it heard *some* Corvus (incl. exotic attractors).
    corvid_signal = 0.0
    for key in CROW_TYPE_CORVUS | RAVEN_TYPE_CORVUS:
        idx = class_index_for_scientific(key)
        if idx is None or idx >= len(mean_probs):
            continue
        corvid_signal = max(corvid_signal, float(mean_probs[idx]))
    if corvid_signal < settings.audio_corvid_type_min_confidence:
        return predictions, heard

    # Decide from the genuine native classes (raven logit de-biased), not the exotic attractors.
    # Empirically the calibrated leader is inverted vs the initial AUDIO_DEBUG read (crow clips
    # run hotter on corax than brachyrhynchos after bias), so higher calibrated raven → Crow.
    crow_logit = _logit_for_key(AMERICAN_CROW_KEY, mean_logits)
    raven_logit = _calibrated_logit_for_key(COMMON_RAVEN_KEY, mean_logits)
    if crow_logit == float("-inf") and raven_logit == float("-inf"):
        return predictions, heard

    if raven_logit >= crow_logit:
        winner_key, winner_on, loser_key = AMERICAN_CROW_KEY, crow_on, COMMON_RAVEN_KEY
    else:
        winner_key, winner_on, loser_key = COMMON_RAVEN_KEY, raven_on, AMERICAN_CROW_KEY

    if not winner_on:
        return predictions, heard

    win_idx = class_index_for_scientific(winner_key)
    if win_idx is None or win_idx >= len(mean_probs):
        return predictions, heard

    boosted = max(
        float(mean_probs[win_idx]),
        corvid_signal * 0.4,
        settings.audio_detection_min_confidence,
    )

    existing = {_species_key(p) for p in predictions + heard}
    if winner_key in existing:
        for prediction in predictions + heard:
            if _species_key(prediction) == winner_key and prediction.confidence < boosted:
                prediction.confidence = boosted
    else:
        pred = make_prediction(win_idx, boosted)
        predictions.append(pred)
        heard.append(pred)

    # Drop the losing-type local species only when it is a spurious congener substitute,
    # never a species Perch actually heard.
    if loser_key not in raw_perch_keys:
        predictions = [p for p in predictions if _species_key(p) != loser_key]
        heard = [p for p in heard if _species_key(p) != loser_key]

    return predictions, heard


def redirect_exotic_confusers_to_jay(
    predictions: list[Prediction],
    heard: list[Prediction],
    mean_probs,
    make_prediction,
    ctx: RegionalContext,
    mean_logits=None,
) -> tuple[list[Prediction], list[Prediction]]:
    """Map high-confidence impossible-exotic hits (e.g. Blue-winged Goose in NA) to Blue Jay.

    Perch frequently classifies phone-recorded Blue Jay calls as ``Cyanochen cyanoptera`` (an
    Ethiopian-highlands endemic) with high confidence while crushing the true jay class in
    softmax (≈0.06%). Such a hit in North America is always a misclassification, and in practice
    it is a Blue Jay. Tightly scoped: NA only, jay must be on the local checklist, the exotic
    signal must be strong, and the true jay class must carry a real logit.
    """
    from inference.sound_taxonomy import class_index_for_scientific

    if ctx.bundle_region != "na":
        return predictions, heard
    if not is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, BLUE_JAY_KEY):
        return predictions, heard

    jay_idx = class_index_for_scientific(BLUE_JAY_KEY)
    if jay_idx is None or jay_idx >= len(mean_probs):
        return predictions, heard

    exotic_prob = 0.0
    for key in JAY_EXOTIC_CONFUSERS:
        idx = class_index_for_scientific(key)
        if idx is None or idx >= len(mean_probs):
            continue
        exotic_prob = max(exotic_prob, float(mean_probs[idx]))

    if exotic_prob < settings.audio_jay_exotic_redirect_min_confidence:
        return predictions, heard

    # Guard against non-jay noise that also lands on the exotic: require a real jay logit.
    if mean_logits is not None:
        jay_logit = _logit_for_key(BLUE_JAY_KEY, mean_logits)
        if jay_logit != float("-inf") and jay_logit < settings.audio_jay_min_redirect_logit:
            return predictions, heard

    existing = {_species_key(p) for p in predictions + heard}
    if BLUE_JAY_KEY in existing:
        return predictions, heard

    jay_prob = float(mean_probs[jay_idx])
    boosted = max(jay_prob, exotic_prob * 0.6, settings.audio_detection_min_confidence)
    pred = make_prediction(jay_idx, boosted)
    predictions.append(pred)
    heard.append(pred)
    return predictions, heard


def prune_mimic_confusers_for_jay(
    predictions: list[Prediction],
    heard: list[Prediction],
    ctx: RegionalContext,
    mean_logits,
    *,
    raw_perch_keys: set[str],
) -> tuple[list[Prediction], list[Prediction]]:
    """Drop weak injected hawks/owls/falcons when Jay is a competitive checklist acoustic."""
    if mean_logits is None or len(mean_logits) == 0:
        return predictions, heard
    if not is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, BLUE_JAY_KEY):
        return predictions, heard

    pool = predictions + heard
    jay_in_pool = any(_species_key(p) == BLUE_JAY_KEY for p in pool)
    if not jay_in_pool:
        return predictions, heard

    jay_logit = _logit_for_key(BLUE_JAY_KEY, mean_logits)
    if jay_logit == float("-inf"):
        return predictions, heard

    margin = settings.audio_jay_mimic_logit_margin
    prune_max = settings.audio_mimic_confuser_prune_max_confidence

    def keep(prediction: Prediction) -> bool:
        key = _species_key(prediction)
        if key == BLUE_JAY_KEY:
            return True
        if not _is_mimic_confuser_genus(_genus(key)):
            return True
        if key in raw_perch_keys:
            return True
        confuser_logit = _logit_for_key(key, mean_logits)
        if jay_logit < confuser_logit - margin:
            return True
        if prediction.confidence >= prune_max:
            return True
        return False

    predictions = [p for p in predictions if keep(p)]
    heard = [p for p in heard if keep(p)]
    return predictions, heard


def disambiguate_checklist_congeners(
    predictions: list[Prediction],
    heard: list[Prediction],
    ctx: RegionalContext,
    mean_logits,
    *,
    raw_perch_keys: set[str] | None = None,
) -> tuple[list[Prediction], list[Prediction]]:
    """Resolve confusable same-genus checklist species (e.g. American Crow vs Common Raven).

    Comparison uses *calibrated* logits (``_calibrated_logit_for_key``) so a species whose Perch
    logit runs systematically hot (e.g. cosmopolitan Common Raven) does not always win. When two
    or more congeners that are BOTH on the local checklist appear in the candidate pool, keep the
    calibrated logit leader and drop congeners trailing it by more than the margin.

    Genuine raw Perch detections are never dropped — only injected/secondary candidates — so this
    can clean up a spurious congener without ever hiding a species the model actually heard.
    """
    if mean_logits is None or len(mean_logits) == 0:
        return predictions, heard

    from collections import defaultdict

    protected = raw_perch_keys or set()
    margin = settings.audio_congener_disambiguation_logit_margin
    keys_by_genus: dict[str, set[str]] = defaultdict(set)
    for prediction in predictions + heard:
        key = _species_key(prediction)
        genus = _genus(key)
        if not genus:
            continue
        if not is_on_regional_checklist(ctx.lat, ctx.lng, ctx.month, key):
            continue
        keys_by_genus[genus].add(key)

    drop: set[str] = set()
    for keys in keys_by_genus.values():
        if len(keys) < 2:
            continue
        logit_by_key = {key: _calibrated_logit_for_key(key, mean_logits) for key in keys}
        leader_key = max(logit_by_key, key=lambda k: logit_by_key[k])
        leader_logit = logit_by_key[leader_key]
        if leader_logit == float("-inf"):
            continue
        for key, logit in logit_by_key.items():
            if key == leader_key:
                continue
            if key in protected:
                continue
            if logit < leader_logit - margin:
                drop.add(key)

    if not drop:
        return predictions, heard

    predictions = [p for p in predictions if _species_key(p) not in drop]
    heard = [p for p in heard if _species_key(p) not in drop]
    return predictions, heard


def native_acoustic_top_keys(
    ctx: RegionalContext,
    mean_logits,
    *,
    top_k: int | None = None,
) -> set[str]:
    """Checklist species with the strongest Perch logits at this location."""
    from inference.checklist import checklist_species_for_coords
    from inference.sound_taxonomy import class_index_for_scientific

    if mean_logits is None or len(mean_logits) == 0:
        return set()

    checklist = checklist_species_for_coords(ctx.lat, ctx.lng, ctx.month)
    ranked: list[tuple[str, float]] = []
    for species in checklist:
        class_idx = class_index_for_scientific(species)
        if class_idx is None or class_idx >= len(mean_logits):
            continue
        ranked.append((species, float(mean_logits[class_idx])))

    ranked.sort(key=lambda item: item[1], reverse=True)
    k = top_k if top_k is not None else settings.audio_acoustic_native_top_k
    return {species for species, _ in ranked[: max(1, k)]}


def rank_by_acoustic_geo(
    predictions: list[Prediction],
    ctx: RegionalContext,
    mean_logits,
) -> list[Prediction]:
    """Rank by native checklist logit first, then geo score, then model confidence.

    Uses calibrated logits so confusable congeners (e.g. Common Raven vs American Crow) are
    compared on a level field rather than by Perch's raw, imbalance-skewed activations.
    """

    def logit_for(prediction: Prediction) -> float:
        return _calibrated_logit_for_key(_species_key(prediction), mean_logits)

    def sort_key(prediction: Prediction) -> tuple:
        return (
            logit_for(prediction),
            score_prediction(ctx, prediction),
            prediction.confidence,
        )

    return sorted(predictions, key=sort_key, reverse=True)


def filter_and_rank_predictions(
    predictions: list[Prediction],
    ctx: RegionalContext | None,
    *,
    strict: bool = False,
    max_results: int | None = None,
    candidate_pool: list[Prediction] | None = None,
) -> tuple[list[Prediction], bool]:
    if ctx is None or not predictions:
        return predictions, False

    pool = candidate_pool if candidate_pool is not None else predictions

    if strict:
        visible = [
            p for p in predictions if should_show_live_sound(ctx, p, pool)
        ]
        ranked = sorted(
            visible,
            key=lambda p: (score_prediction(ctx, p), p.confidence),
            reverse=True,
        )
        if not ranked:
            fallback = [
                p
                for p in predictions
                if should_show_live_sound(ctx, p, pool)
                and p.confidence >= settings.audio_detection_min_confidence
            ]
            ranked = sorted(
                fallback,
                key=lambda p: (score_prediction(ctx, p), p.confidence),
                reverse=True,
            )
    else:
        visible = [p for p in predictions if should_show(ctx, p)]
        ranked = sorted(visible, key=lambda p: score_prediction(ctx, p), reverse=True)

    if max_results is not None:
        ranked = ranked[:max_results]
    return ranked, True
