"""
Verification tool: runs a fixed test sequence through the real Python/Keras
predictor and prints risk_level/risk_score/forecast as JSON.

Used to confirm the TensorFlow.js port (frontend/scripts/verify_model.mjs) is
numerically faithful to the original trained model — run both scripts with the
same test sequence and diff the JSON output. They should match (near) exactly.

Usage: python backend/scripts/verify_model.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.predictor import predict
from app.schemas import DailyFeatures, PredictRequest

FEATURE_ORDER = [
    "time_social_media", "time_video_streaming", "time_gaming", "time_productivity",
    "time_education", "time_news", "time_shopping", "time_communication", "time_other",
    "compulsive_check_count", "tab_switch_frequency", "late_night_ratio", "active_idle_ratio",
    "avg_session_length_min", "daily_goal", "goal_alignment_score", "mood_score", "stress_score",
    "sleep_quality",
]


def day(i: int) -> DailyFeatures:
    """Must exactly match the `day()` generator in frontend/scripts/verify_model.mjs."""
    vals = [
        90 + i * 2, 40, 20, 60, 10, 15, 5, 25, 8,
        18 + i, 12, 0.2 + i * 0.01, 0.6, 22, 0, 0.55, 3, 3 + i * 0.05, 3,
    ]
    return DailyFeatures(**dict(zip(FEATURE_ORDER, vals)))


def main() -> None:
    sequence = [day(i) for i in range(14)]
    req = PredictRequest(sequence=sequence, goal_label="study", coach_tone="balanced")
    result = predict(req)

    print(json.dumps({
        "risk_level": result.risk_level,
        "risk_score": result.risk_score,
        "forecast": result.forecast,
    }, indent=2))


if __name__ == "__main__":
    main()
