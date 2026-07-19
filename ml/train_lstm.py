"""
Train multi-output LSTM: risk class, risk score, 7-day forecast.
Saves model + scaler to backend/models/
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shared.feature_schema import (
    FEATURE_NAMES,
    FORECAST_HORIZON,
    NUM_FEATURES,
    RiskLevel,
    SEQUENCE_LENGTH,
)

DATA_PATH = Path(__file__).resolve().parent / "data" / "lstm_sequences.npz"
MODEL_DIR = ROOT / "backend" / "models"


def build_model(seq_len: int = SEQUENCE_LENGTH, n_features: int = NUM_FEATURES) -> keras.Model:
    inputs = keras.Input(shape=(seq_len, n_features), name="sequence")
    x = layers.Masking(mask_value=0.0)(inputs)
    x = layers.LSTM(64, dropout=0.2)(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(0.2)(x)

    class_out = layers.Dense(len(RiskLevel), activation="softmax", name="risk_class")(x)
    score_out = layers.Dense(1, activation="sigmoid", name="risk_score")(x)
    forecast_out = layers.Dense(FORECAST_HORIZON, activation="sigmoid", name="forecast")(x)

    return keras.Model(inputs=inputs, outputs=[class_out, score_out, forecast_out])


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Run synthetic_data_generator.py first. Missing {DATA_PATH}")

    data = np.load(DATA_PATH)
    X, y_class, y_forecast = data["X"], data["y_class"], data["y_forecast"]

    # Derive continuous risk score from class + forecast mean for score head labels
    y_score = y_forecast[:, 0:1]

    n_samples, seq_len, n_features = X.shape
    flat = X.reshape(-1, n_features)
    scaler = StandardScaler()
    flat_scaled = scaler.fit_transform(flat)
    X_scaled = flat_scaled.reshape(n_samples, seq_len, n_features)

    X_train, X_val, yc_tr, yc_val, ys_tr, ys_val, yf_tr, yf_val = train_test_split(
        X_scaled, y_class, y_score, y_forecast, test_size=0.15, random_state=42
    )

    model = build_model(seq_len, n_features)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss={
            "risk_class": "sparse_categorical_crossentropy",
            "risk_score": "mse",
            "forecast": "mse",
        },
        loss_weights={"risk_class": 1.0, "risk_score": 0.5, "forecast": 1.0},
        metrics={
            "risk_class": "accuracy",
            "risk_score": "mae",
            "forecast": "mae",
        },
    )

    callbacks = [
        keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(patience=3, factor=0.5),
    ]

    print(f"Training on {len(X_train)} sequences, validating on {len(X_val)}")
    history = model.fit(
        X_train,
        {"risk_class": yc_tr, "risk_score": ys_tr, "forecast": yf_tr},
        validation_data=(X_val, {"risk_class": yc_val, "risk_score": ys_val, "forecast": yf_val}),
        epochs=30,
        batch_size=64,
        callbacks=callbacks,
        verbose=1,
    )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODEL_DIR / "lstm_model.keras"
    model.save(model_path)

    scaler_path = MODEL_DIR / "scaler.npz"
    np.savez(scaler_path, mean=scaler.mean_, scale=scaler.scale_)

    val_loss = min(history.history["val_loss"])
    acc = max(history.history.get("val_risk_class_accuracy", [0]))

    meta = {
        "sequence_length": SEQUENCE_LENGTH,
        "forecast_horizon": FORECAST_HORIZON,
        "num_features": NUM_FEATURES,
        "feature_names": list(FEATURE_NAMES),
        "risk_levels": [r.value for r in RiskLevel],
        "val_loss": float(val_loss),
        "val_accuracy": float(acc),
        "model_path": str(model_path.name),
    }
    (MODEL_DIR / "model_meta.json").write_text(json.dumps(meta, indent=2))

    print(f"Model saved to {model_path}")
    print(f"Validation accuracy: {acc:.2%}")


if __name__ == "__main__":
    main()
