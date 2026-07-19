"""Canonical feature definitions shared across ML, backend, and extension."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Final

SEQUENCE_LENGTH: Final[int] = 14  # days of history fed to LSTM
FORECAST_HORIZON: Final[int] = 7   # days ahead to predict


class DailyGoal(str, Enum):
    STUDY = "study"
    WORK = "work"
    ENTERTAINMENT = "entertainment"
    RELAX = "relax"


class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


# Domain categories mapped by extension lookup table
CATEGORIES: Final[tuple[str, ...]] = (
    "social_media",
    "video_streaming",
    "gaming",
    "productivity",
    "education",
    "news",
    "shopping",
    "communication",
    "other",
)


@dataclass(frozen=True)
class DailyFeatureVector:
    """One day's engineered features — the LSTM input unit."""

    date: str  # ISO date YYYY-MM-DD
    # Time per category (minutes)
    time_social_media: float = 0.0
    time_video_streaming: float = 0.0
    time_gaming: float = 0.0
    time_productivity: float = 0.0
    time_education: float = 0.0
    time_news: float = 0.0
    time_shopping: float = 0.0
    time_communication: float = 0.0
    time_other: float = 0.0
    # Behavioral shape features
    compulsive_check_count: int = 0
    tab_switch_frequency: float = 0.0  # switches per hour
    late_night_ratio: float = 0.0      # fraction of usage after 11pm
    active_idle_ratio: float = 0.0     # active / (active + idle)
    avg_session_length_min: float = 0.0
    # Context features
    daily_goal: DailyGoal = DailyGoal.STUDY
    goal_alignment_score: float = 0.0  # 0-1, how well usage matched goal
    mood_score: float = 3.0            # 1-5 tap scale
    stress_score: float = 3.0          # 1-5 tap scale
    sleep_quality: float = 3.0         # 1-5 tap scale

    def to_model_array(self) -> list[float]:
        return [
            self.time_social_media,
            self.time_video_streaming,
            self.time_gaming,
            self.time_productivity,
            self.time_education,
            self.time_news,
            self.time_shopping,
            self.time_communication,
            self.time_other,
            self.compulsive_check_count,
            self.tab_switch_frequency,
            self.late_night_ratio,
            self.active_idle_ratio,
            self.avg_session_length_min,
            float(list(DailyGoal).index(self.daily_goal)),
            self.goal_alignment_score,
            self.mood_score,
            self.stress_score,
            self.sleep_quality,
        ]


FEATURE_NAMES: Final[tuple[str, ...]] = (
    "time_social_media",
    "time_video_streaming",
    "time_gaming",
    "time_productivity",
    "time_education",
    "time_news",
    "time_shopping",
    "time_communication",
    "time_other",
    "compulsive_check_count",
    "tab_switch_frequency",
    "late_night_ratio",
    "active_idle_ratio",
    "avg_session_length_min",
    "daily_goal",
    "goal_alignment_score",
    "mood_score",
    "stress_score",
    "sleep_quality",
)

NUM_FEATURES: Final[int] = len(FEATURE_NAMES)
