"""
Exports everything the browser needs to run inference without a backend server:
  1. LSTM layer weights (as plain JSON arrays) -> frontend/public/model/lstm_weights.json
  2. Scaler mean/scale -> frontend/public/model/scaler.json
  3. Precomputed cohort statistics (percentile lookup + mood/usage insight) ->
     frontend/public/model/cohort_stats.json

This keeps the exact same trained model and the exact same synthetic cohort dataset —
nothing here changes the model's behavior, it just moves inference from a Python
process to the browser via TensorFlow.js.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np
from tensorflow import keras

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "backend" / "models"
OUT_DIR = ROOT / "frontend" / "public" / "model"
CSV_PATH = ROOT / "ml" / "data" / "synthetic_daily_features.csv"

OUT_DIR.mkdir(parents=True, exist_ok=True)


def export_weights() -> None:
    model = keras.models.load_model(MODEL_DIR / "lstm_model.keras")

    layers_out = []
    for layer in model.layers:
        weights = layer.get_weights()
        if not weights:
            continue
        layers_out.append(
            {
                "name": layer.name,
                "className": layer.__class__.__name__,
                "weights": [w.tolist() for w in weights],
                "shapes": [list(w.shape) for w in weights],
            }
        )

    (OUT_DIR / "lstm_weights.json").write_text(json.dumps(layers_out))
    print(f"Exported {len(layers_out)} weighted layers -> {OUT_DIR / 'lstm_weights.json'}")

    meta_src = MODEL_DIR / "model_meta.json"
    (OUT_DIR / "model_meta.json").write_text(meta_src.read_text())
    print(f"Copied model_meta.json -> {OUT_DIR / 'model_meta.json'}")


def export_scaler() -> None:
    scaler = np.load(MODEL_DIR / "scaler.npz")
    payload = {"mean": scaler["mean"].tolist(), "scale": scaler["scale"].tolist()}
    (OUT_DIR / "scaler.json").write_text(json.dumps(payload))
    print(f"Exported scaler -> {OUT_DIR / 'scaler.json'}")


def export_cohort_stats() -> None:
    if not CSV_PATH.exists():
        print(f"WARNING: {CSV_PATH} not found, skipping cohort stats")
        return

    scores: list[float] = []
    high_stress: list[float] = []
    low_stress: list[float] = []

    with CSV_PATH.open(newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                scores.append(float(row["risk_score"]))
            except (KeyError, ValueError):
                pass
            try:
                stress = float(row["stress_score"])
                minutes = (
                    float(row["time_social_media"])
                    + float(row["time_video_streaming"])
                    + float(row["time_gaming"])
                )
            except (KeyError, ValueError):
                continue
            if stress >= 4:
                high_stress.append(minutes)
            elif stress <= 2:
                low_stress.append(minutes)

    scores.sort()

    mood_usage = None
    if high_stress and low_stress:
        high_avg = sum(high_stress) / len(high_stress)
        low_avg = sum(low_stress) / len(low_stress)
        pct_diff = ((high_avg - low_avg) / low_avg * 100) if low_avg > 0 else 0.0
        mood_usage = {
            "high_stress_avg_min": round(high_avg, 1),
            "low_stress_avg_min": round(low_avg, 1),
            "pct_diff": round(pct_diff, 1),
            "sample_size": len(high_stress) + len(low_stress),
        }

    payload = {"sorted_scores": [round(s, 4) for s in scores], "mood_usage": mood_usage}
    (OUT_DIR / "cohort_stats.json").write_text(json.dumps(payload))
    print(f"Exported cohort stats ({len(scores)} scores) -> {OUT_DIR / 'cohort_stats.json'}")


if __name__ == "__main__":
    export_weights()
    export_scaler()
    export_cohort_stats()
    print("Done.")
