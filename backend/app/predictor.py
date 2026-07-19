"""Load LSTM model and run inference."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from tensorflow import keras

from .cohort import percentile_better_than
from .explain import build_explanation, build_nudge, compute_contributors
from .schemas import DailyFeatures, NudgeOut, PredictRequest, PredictResponse

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"

_model: keras.Model | None = None
_scaler_mean: np.ndarray | None = None
_scaler_scale: np.ndarray | None = None
_meta: dict | None = None


def _load_assets() -> None:
    global _model, _scaler_mean, _scaler_scale, _meta

    if _model is not None:
        return

    meta_path = MODEL_DIR / "model_meta.json"
    model_path = MODEL_DIR / "lstm_model.keras"
    scaler_path = MODEL_DIR / "scaler.npz"

    if not model_path.exists():
        raise FileNotFoundError(
            f"Model not found at {model_path}. Run: python ml/train_lstm.py"
        )

    _meta = json.loads(meta_path.read_text())
    _model = keras.models.load_model(model_path)
    scaler = np.load(scaler_path)
    _scaler_mean = scaler["mean"]
    _scaler_scale = scaler["scale"]


def _scale_sequence(seq: np.ndarray) -> np.ndarray:
    n_days, n_feat = seq.shape
    flat = seq.reshape(-1, n_feat)
    scaled = (flat - _scaler_mean) / _scaler_scale
    return scaled.reshape(1, n_days, n_feat)


def _pad_sequence(days: list[DailyFeatures], seq_len: int) -> np.ndarray:
    vectors = [d.to_vector() for d in days]
    if len(vectors) >= seq_len:
        return np.array(vectors[-seq_len:], dtype=np.float32)

    # Pad start with first available day (or zeros)
    pad = [vectors[0]] * (seq_len - len(vectors)) if vectors else [[0.0] * 19] * seq_len
    if not vectors:
        return np.array(pad, dtype=np.float32)
    padded = pad + vectors
    return np.array(padded[-seq_len:], dtype=np.float32)


def predict(req: PredictRequest) -> PredictResponse:
    _load_assets()
    assert _model is not None and _meta is not None

    seq_len = _meta["sequence_length"]
    feature_names: list[str] = _meta["feature_names"]
    risk_levels: list[str] = _meta["risk_levels"]

    raw = _pad_sequence(req.sequence, seq_len)
    scaled = _scale_sequence(raw)

    class_probs, risk_score, forecast = _model.predict(scaled, verbose=0)
    class_idx = int(np.argmax(class_probs[0]))
    risk_level = risk_levels[class_idx]
    score = float(risk_score[0][0])
    forecast_vals = [float(v) for v in forecast[0]]

    # Baseline = mean of sequence (excluding last day)
    baseline = raw[:-1].mean(axis=0).tolist() if len(raw) > 1 else raw[0].tolist()
    last_day = raw[-1].tolist()

    contributors = compute_contributors(last_day, baseline, feature_names)
    explanation = build_explanation(
        risk_level, score, contributors, req.goal_label, last_day, feature_names
    )
    feature_idx = {name: i for i, name in enumerate(feature_names)}
    late_night_ratio = last_day[feature_idx["late_night_ratio"]] if "late_night_ratio" in feature_idx else 0.0
    nudge = build_nudge(score, contributors, req.coach_tone, late_night_ratio)

    return PredictResponse(
        risk_level=risk_level,
        risk_score=round(score, 4),
        forecast=forecast_vals,
        explanation=explanation,
        contributors=contributors,
        nudge=NudgeOut(
            message=nudge["message"],
            window_start=nudge["window_start"],
            window_end=nudge["window_end"],
        ),
        cohort_percentile=percentile_better_than(score),
        model_version="lstm_v1",
    )


def model_ready() -> bool:
    return (MODEL_DIR / "lstm_model.keras").exists()
