from pydantic import BaseModel, Field


class DailyFeatures(BaseModel):
    time_social_media: float = 0
    time_video_streaming: float = 0
    time_gaming: float = 0
    time_productivity: float = 0
    time_education: float = 0
    time_news: float = 0
    time_shopping: float = 0
    time_communication: float = 0
    time_other: float = 0
    compulsive_check_count: float = 0
    tab_switch_frequency: float = 0
    late_night_ratio: float = 0
    active_idle_ratio: float = 0.5
    avg_session_length_min: float = 10
    daily_goal: float = 0  # 0-3 encoded
    goal_alignment_score: float = 0.5
    mood_score: float = 3
    stress_score: float = 3
    sleep_quality: float = 3

    def to_vector(self) -> list[float]:
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
            self.daily_goal,
            self.goal_alignment_score,
            self.mood_score,
            self.stress_score,
            self.sleep_quality,
        ]


class PredictRequest(BaseModel):
    """14 days of features, oldest first. Pad with zeros if fewer days available."""
    sequence: list[DailyFeatures] = Field(..., min_length=1, max_length=14)
    goal_label: str = "study"
    coach_tone: str = "balanced"  # gentle | direct | balanced


class ContributorOut(BaseModel):
    feature: str
    label: str
    impact: float
    direction: str


class NudgeOut(BaseModel):
    message: str
    window_start: str
    window_end: str


class PredictResponse(BaseModel):
    risk_level: str
    risk_score: float
    forecast: list[float]
    explanation: str
    contributors: list[ContributorOut]
    nudge: NudgeOut
    cohort_percentile: float | None = None
    model_version: str
