"""Population-level behavioral insights mined from the synthetic dataset."""

from __future__ import annotations

import csv
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "ml" / "data" / "synthetic_daily_features.csv"

_cached: dict | None = None


def _distraction_minutes(row: dict) -> float:
    return (
        float(row["time_social_media"])
        + float(row["time_video_streaming"])
        + float(row["time_gaming"])
    )


def mood_usage_insight() -> dict | None:
    """Compares distraction-app time on high-stress vs low-stress days across the cohort."""
    global _cached
    if _cached is not None:
        return _cached

    if not DATA_PATH.exists():
        return None

    high_stress: list[float] = []
    low_stress: list[float] = []

    with DATA_PATH.open(newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                stress = float(row["stress_score"])
                minutes = _distraction_minutes(row)
            except (KeyError, ValueError):
                continue
            if stress >= 4:
                high_stress.append(minutes)
            elif stress <= 2:
                low_stress.append(minutes)

    if not high_stress or not low_stress:
        return None

    high_avg = sum(high_stress) / len(high_stress)
    low_avg = sum(low_stress) / len(low_stress)
    pct_diff = ((high_avg - low_avg) / low_avg * 100) if low_avg > 0 else 0.0

    _cached = {
        "high_stress_avg_min": round(high_avg, 1),
        "low_stress_avg_min": round(low_avg, 1),
        "pct_diff": round(pct_diff, 1),
        "sample_size": len(high_stress) + len(low_stress),
    }
    return _cached
