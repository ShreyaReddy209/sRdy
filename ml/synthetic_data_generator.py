"""
Generate synthetic behavioral sequences for LSTM training and demo.

Produces realistic daily feature vectors with correlated risk patterns so the
model can learn meaningful temporal structure before real extension data exists.
"""

from __future__ import annotations

import json
import random
from dataclasses import asdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.feature_schema import (
    DailyFeatureVector,
    DailyGoal,
    FEATURE_NAMES,
    FORECAST_HORIZON,
    RiskLevel,
    SEQUENCE_LENGTH,
)


def _risk_from_features(fv: DailyFeatureVector) -> float:
    """Heuristic risk score 0-1 used to label synthetic data."""
    distraction = (
        fv.time_social_media * 1.2
        + fv.time_video_streaming * 1.0
        + fv.time_gaming * 1.3
    ) / 300.0
    compulsive = min(fv.compulsive_check_count / 40.0, 1.0)
    late = fv.late_night_ratio * 1.5
    misaligned = 1.0 - fv.goal_alignment_score
    stress = (fv.stress_score - 1) / 4.0
    sleep_penalty = (5 - fv.sleep_quality) / 4.0 * 0.3
    return float(np.clip(
        distraction * 0.35
        + compulsive * 0.25
        + late * 0.15
        + misaligned * 0.15
        + stress * 0.05
        + sleep_penalty,
        0,
        1,
    ))


def _score_to_risk(score: float) -> RiskLevel:
    if score < 0.25:
        return RiskLevel.LOW
    if score < 0.5:
        return RiskLevel.MODERATE
    if score < 0.75:
        return RiskLevel.HIGH
    return RiskLevel.CRITICAL


def _generate_day(
    day_date: date,
    goal: DailyGoal,
    prev_risk: float,
    rng: random.Random,
) -> DailyFeatureVector:
    """Generate one day with momentum — high-risk days tend to follow high-risk."""
    momentum = prev_risk * 0.6 + rng.uniform(0, 0.4)

    base_social = rng.uniform(20, 120) * (0.5 + momentum)
    base_video = rng.uniform(15, 90) * (0.4 + momentum)
    base_gaming = rng.uniform(0, 60) * momentum
    base_productivity = rng.uniform(30, 180) * (1.2 - momentum * 0.5)
    base_education = rng.uniform(20, 150) * (1.1 - momentum * 0.4)

    if goal == DailyGoal.STUDY:
        base_education *= 1.4
        base_productivity *= 1.2
    elif goal == DailyGoal.WORK:
        base_productivity *= 1.5
    elif goal == DailyGoal.ENTERTAINMENT:
        base_video *= 1.6
        base_gaming *= 1.4
    elif goal == DailyGoal.RELAX:
        base_social *= 0.8
        base_video *= 1.2

    compulsive = int(rng.uniform(5, 50) * (0.3 + momentum))
    late_night = rng.uniform(0.05, 0.6) * (0.4 + momentum)
    tab_switches = rng.uniform(2, 25) * (0.5 + momentum)
    mood = max(1, min(5, round(3.5 - momentum * 2 + rng.gauss(0, 0.8))))
    stress = max(1, min(5, round(2.5 + momentum * 2 + rng.gauss(0, 0.8))))
    sleep = max(1, min(5, round(4 - momentum * 1.5 + rng.gauss(0, 0.6))))

    productive_time = base_productivity + base_education
    distraction_time = base_social + base_video + base_gaming
    total = productive_time + distraction_time + 1e-6
    alignment = productive_time / total if goal in (DailyGoal.STUDY, DailyGoal.WORK) else (
        distraction_time / total if goal in (DailyGoal.ENTERTAINMENT, DailyGoal.RELAX) else 0.5
    )

    fv = DailyFeatureVector(
        date=day_date.isoformat(),
        time_social_media=round(base_social, 1),
        time_video_streaming=round(base_video, 1),
        time_gaming=round(base_gaming, 1),
        time_productivity=round(base_productivity, 1),
        time_education=round(base_education, 1),
        time_news=round(rng.uniform(5, 30), 1),
        time_shopping=round(rng.uniform(0, 20), 1),
        time_communication=round(rng.uniform(10, 45), 1),
        time_other=round(rng.uniform(5, 25), 1),
        compulsive_check_count=compulsive,
        tab_switch_frequency=round(tab_switches, 2),
        late_night_ratio=round(late_night, 3),
        active_idle_ratio=round(rng.uniform(0.4, 0.85), 3),
        avg_session_length_min=round(rng.uniform(3, 25), 1),
        daily_goal=goal,
        goal_alignment_score=round(float(np.clip(alignment, 0, 1)), 3),
        mood_score=float(mood),
        stress_score=float(stress),
        sleep_quality=float(sleep),
    )
    return fv


def generate_user_sequence(
    user_id: str,
    num_days: int = 60,
    seed: int | None = None,
) -> list[dict]:
    rng = random.Random(seed or hash(user_id) % 2**32)
    goals = list(DailyGoal)
    start = date.today() - timedelta(days=num_days)
    prev_risk = rng.uniform(0.2, 0.5)
    rows: list[dict] = []

    for i in range(num_days):
        day_date = start + timedelta(days=i)
        goal = rng.choices(goals, weights=[0.35, 0.25, 0.25, 0.15], k=1)[0]
        fv = _generate_day(day_date, goal, prev_risk, rng)
        risk_score = _risk_from_features(fv)
        prev_risk = risk_score * 0.7 + prev_risk * 0.3
        row = asdict(fv)
        row["daily_goal"] = fv.daily_goal.value
        row["user_id"] = user_id
        row["risk_score"] = round(risk_score, 4)
        row["risk_level"] = _score_to_risk(risk_score).value
        rows.append(row)
    return rows


def build_lstm_sequences(
    df: pd.DataFrame,
    seq_len: int = SEQUENCE_LENGTH,
    horizon: int = FORECAST_HORIZON,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Build (X, y_class, y_forecast) from per-user daily rows.

    X shape: (samples, seq_len, num_features)
    y_class: risk level index at end of window
    y_forecast: risk scores for next `horizon` days
    """
    feature_cols = list(FEATURE_NAMES)
    risk_levels = [r.value for r in RiskLevel]
    goal_values = [g.value for g in DailyGoal]
    X_list, y_class_list, y_forecast_list = [], [], []

    for user_id, group in df.groupby("user_id"):
        group = group.sort_values("date").reset_index(drop=True).copy()
        group["daily_goal"] = group["daily_goal"].map(lambda x: goal_values.index(x))
        features = group[feature_cols].values.astype(np.float32)
        risks = group["risk_score"].values.astype(np.float32)
        levels = group["risk_level"].map(lambda x: risk_levels.index(x)).values

        for i in range(seq_len, len(group) - horizon):
            X_list.append(features[i - seq_len : i])
            y_class_list.append(levels[i])
            y_forecast_list.append(risks[i : i + horizon])

    return (
        np.array(X_list, dtype=np.float32),
        np.array(y_class_list, dtype=np.int32),
        np.array(y_forecast_list, dtype=np.float32),
    )


def generate_dataset(
    num_users: int = 200,
    days_per_user: int = 60,
    output_dir: str | Path | None = None,
) -> Path:
    if output_dir is None:
        output_dir = Path(__file__).resolve().parent / "data"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    all_rows: list[dict] = []
    for u in range(num_users):
        user_id = f"user_{u:04d}"
        all_rows.extend(generate_user_sequence(user_id, days_per_user, seed=u * 17 + 3))

    df = pd.DataFrame(all_rows)
    csv_path = output_dir / "synthetic_daily_features.csv"
    df.to_csv(csv_path, index=False)

    X, y_class, y_forecast = build_lstm_sequences(df)
    np.savez(
        output_dir / "lstm_sequences.npz",
        X=X,
        y_class=y_class,
        y_forecast=y_forecast,
        feature_names=np.array(FEATURE_NAMES),
    )

    meta = {
        "num_users": num_users,
        "days_per_user": days_per_user,
        "total_rows": len(df),
        "num_sequences": len(X),
        "sequence_length": SEQUENCE_LENGTH,
        "forecast_horizon": FORECAST_HORIZON,
        "num_features": len(FEATURE_NAMES),
        "feature_names": list(FEATURE_NAMES),
        "risk_levels": [r.value for r in RiskLevel],
    }
    (output_dir / "dataset_meta.json").write_text(json.dumps(meta, indent=2))

    print(f"Generated {len(df)} daily rows from {num_users} users")
    print(f"Built {len(X)} LSTM sequences -> {output_dir / 'lstm_sequences.npz'}")
    return csv_path


if __name__ == "__main__":
    generate_dataset()
