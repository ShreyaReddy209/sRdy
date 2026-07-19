"""Cohort benchmarking against the synthetic population dataset."""

from __future__ import annotations

import csv
from pathlib import Path

import numpy as np

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "ml" / "data" / "synthetic_daily_features.csv"

_population_scores: np.ndarray | None = None


def _load_population() -> np.ndarray:
    global _population_scores
    if _population_scores is not None:
        return _population_scores

    if not DATA_PATH.exists():
        _population_scores = np.array([], dtype=np.float32)
        return _population_scores

    scores: list[float] = []
    with DATA_PATH.open(newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                scores.append(float(row["risk_score"]))
            except (KeyError, ValueError):
                continue

    _population_scores = np.array(scores, dtype=np.float32)
    return _population_scores


def percentile_better_than(risk_score: float) -> float | None:
    """% of the cohort with an equal-or-higher risk score (higher = user is doing better)."""
    population = _load_population()
    if population.size == 0:
        return None
    return round(float((population >= risk_score).mean() * 100), 1)
