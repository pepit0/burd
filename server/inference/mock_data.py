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
    # Descending, plausible confidences.
    base = random.uniform(0.78, 0.97)
    out: list[tuple[str, str, float]] = []
    conf = base
    for common, sci in picks:
        out.append((common, sci, round(conf, 4)))
        conf *= random.uniform(0.35, 0.6)
    return out
