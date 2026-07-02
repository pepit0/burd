import random

# Small sample list used only in mock mode to return plausible predictions.
SAMPLE_BIRDS = [
    ("Northern Cardinal", "Cardinalis cardinalis"),
    ("American Robin", "Turdus migratorius"),
    ("Blue Jay", "Cyanocitta cristata"),
    ("Cedar Waxwing", "Bombycilla cedrorum"),
    ("Black-capped Chickadee", "Poecile atricapillus"),
    ("American Goldfinch", "Spinus tristis"),
    ("Red-tailed Hawk", "Buteo jamaicensis"),
    ("Song Sparrow", "Melospiza melodia"),
    ("Downy Woodpecker", "Dryobates pubescens"),
    ("Mourning Dove", "Zenaida macroura"),
]


def mock_predictions(top_k: int) -> list[tuple[str, str, float]]:
    picks = random.sample(SAMPLE_BIRDS, k=min(top_k, len(SAMPLE_BIRDS)))
    base = random.uniform(0.78, 0.97)
    out: list[tuple[str, str, float]] = []
    conf = base
    for common, sci in picks:
        out.append((common, sci, round(conf, 4)))
        conf *= random.uniform(0.35, 0.6)
    return out


def mock_heard_species(
    max_species: int,
    min_confidence: float,
) -> list[tuple[str, str, float]]:
    count = random.randint(2, min(max_species, 4))
    picks = random.sample(SAMPLE_BIRDS, k=count)
    base = random.uniform(0.55, 0.82)
    out: list[tuple[str, str, float]] = []
    conf = base
    for common, sci in picks:
        value = round(conf, 4)
        if value < min_confidence:
            value = round(min_confidence + random.uniform(0.02, 0.12), 4)
        out.append((common, sci, value))
        conf *= random.uniform(0.45, 0.72)
    return out
