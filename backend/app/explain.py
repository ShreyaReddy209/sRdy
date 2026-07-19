"""Plain-language explanations from feature attributions."""

from __future__ import annotations

FEATURE_LABELS: dict[str, str] = {
    "time_social_media": "Social media time",
    "time_video_streaming": "Video streaming time",
    "time_gaming": "Gaming time",
    "time_productivity": "Productivity app time",
    "time_education": "Education site time",
    "compulsive_check_count": "Compulsive tab checks",
    "tab_switch_frequency": "Tab switching frequency",
    "late_night_ratio": "Late-night usage",
    "goal_alignment_score": "Goal alignment",
    "mood_score": "Mood level",
    "stress_score": "Stress level",
    "sleep_quality": "Sleep quality",
}

# Higher value = higher risk for these features
RISK_UP_FEATURES = {
    "time_social_media",
    "time_video_streaming",
    "time_gaming",
    "compulsive_check_count",
    "tab_switch_frequency",
    "late_night_ratio",
    "stress_score",
}

def compute_contributors(
    last_day: list[float],
    baseline: list[float],
    feature_names: list[str],
    top_k: int = 5,
) -> list[dict]:
    """Compare last day features to baseline; rank by deviation × risk direction."""
    scores: list[tuple[str, float, str]] = []

    for i, name in enumerate(feature_names):
        if name not in FEATURE_LABELS:
            continue
        diff = last_day[i] - baseline[i]
        if abs(diff) < 1e-6:
            continue

        if name == "goal_alignment_score":
            direction = "up" if diff < 0 else "down"
            impact = min(abs(diff) / max(baseline[i], 0.1), 1.0)
        elif name in RISK_UP_FEATURES:
            direction = "up" if diff > 0 else "down"
            impact = min(abs(diff) / max(abs(baseline[i]), 1.0), 1.0)
        elif name == "mood_score" or name == "sleep_quality":
            direction = "up" if diff < 0 else "down"
            impact = min(abs(diff) / 5.0, 1.0)
        else:
            continue

        if impact < 0.05:
            continue
        scores.append((name, impact, direction))

    scores.sort(key=lambda x: x[1], reverse=True)

    if not scores:
        # Fallback when sequence is flat: rank by absolute feature magnitude
        for i, name in enumerate(feature_names):
            if name not in FEATURE_LABELS:
                continue
            val = last_day[i]
            if name in RISK_UP_FEATURES and val > 0:
                impact = min(val / 100.0 if "time_" in name else val / 40.0, 1.0)
                if impact > 0.05:
                    scores.append((name, impact, "up"))
            elif name == "goal_alignment_score" and val < 0.6:
                scores.append((name, 1.0 - val, "down"))
        scores.sort(key=lambda x: x[1], reverse=True)

    total = sum(s[1] for s in scores[:top_k]) or 1.0

    return [
        {
            "feature": name,
            "label": FEATURE_LABELS.get(name, name),
            "impact": round(impact / total, 2),
            "direction": direction,
        }
        for name, impact, direction in scores[:top_k]
    ]


def build_explanation(
    risk_level: str,
    risk_score: float,
    contributors: list[dict],
    goal_label: str,
    last_day: list[float],
    feature_names: list[str],
) -> str:
    idx = {n: i for i, n in enumerate(feature_names)}
    parts: list[str] = []

    parts.append(
        f"Your behavioral risk is {risk_level} ({int(risk_score * 100)}%) based on the last 14 days of patterns."
    )

    if contributors:
        top = contributors[0]
        parts.append(
            f"The strongest signal is {top['label'].lower()} "
            f"({'pushing risk up' if top['direction'] == 'up' else 'helping keep risk down'})."
        )

    if "compulsive_check_count" in idx:
        checks = int(last_day[idx["compulsive_check_count"]])
        if checks > 25:
            parts.append(f"You had {checks} short tab-check sessions today, which often indicates compulsive checking.")

    if "late_night_ratio" in idx:
        late = last_day[idx["late_night_ratio"]]
        if late > 0.35:
            parts.append(f"About {int(late * 100)}% of usage happened after 11 PM.")

    if "goal_alignment_score" in idx:
        align = last_day[idx["goal_alignment_score"]]
        parts.append(
            f"With a {goal_label} goal, only {int(align * 100)}% of your screen time aligned with that intent."
        )

    return " ".join(parts)


NUDGE_TEMPLATES: dict[str, dict[str, str]] = {
    "high_risk": {
        "gentle": (
            "Today's been a heavier screen day, and that's okay. Your own recent activity shows a real pattern "
            "of being active late in the evening — maybe try a gentle 5-minute pause around {window_start}, "
            "just to check in with yourself."
        ),
        "direct": (
            "Risk is high. Your tracked usage shows you're typically still active around {window_start}. "
            "Take a 5-minute break then — no excuses tonight."
        ),
        "balanced": (
            "Your risk is trending high. Your tracked usage shows a real late-evening pattern around "
            "{window_start}. Try a 5-minute break then — it may prevent another high-risk evening."
        ),
    },
    "high_risk_generic": {
        "gentle": (
            "Today's been a heavier screen day, and that's okay. A short, gentle pause sometime today — even "
            "just 5 minutes — could help before it builds further."
        ),
        "direct": "Risk is high today. Take a 5-minute break now and reset before it builds further.",
        "balanced": (
            "Your risk is trending high today. A short break now could help prevent it from building further."
        ),
    },
    "compulsive": {
        "gentle": (
            "Looks like you've been checking tabs a lot today — totally normal when things feel stressful. "
            "Your tracked activity shows this tends to happen later in the evening, around {window_start} — "
            "maybe close a few tabs then and pick one thing to focus on."
        ),
        "direct": (
            "Too much tab-switching today, usually picking up again around {window_start}. "
            "Close non-essential tabs now and lock in one task."
        ),
        "balanced": (
            "Frequent tab-checking is driving your score, and your tracked activity shows it tends to happen "
            "around {window_start}. Close non-essential tabs and set a single focus task before then."
        ),
    },
    "compulsive_generic": {
        "gentle": (
            "Looks like you've been checking tabs a lot today — totally normal when things feel stressful. "
            "Closing a few tabs now and picking one thing to focus on could help."
        ),
        "direct": "Too much tab-switching today. Close non-essential tabs now and lock in one task.",
        "balanced": (
            "Frequent tab-checking is driving your score today. Closing non-essential tabs and setting a "
            "single focus task could help."
        ),
    },
    "manageable": {
        "gentle": (
            "You're doing well today. Your tracked activity shows you're sometimes still online around "
            "{window_start} — a short, kind check-in with yourself around then could help you keep this going."
        ),
        "direct": "Patterns are fine. Do a quick check-in around {window_start} and stay on track.",
        "balanced": (
            "Patterns look manageable. Your tracked activity shows you're sometimes still online around "
            "{window_start} — a short check-in then can help you stay on track with your stated goal."
        ),
    },
    "manageable_generic": {
        "gentle": "You're doing well today. A short, kind check-in with yourself later could help you keep this going.",
        "direct": "Patterns are fine. Do a quick check-in later today and stay on track.",
        "balanced": (
            "Patterns look manageable today. A short check-in later can help you stay on track with your "
            "stated goal."
        ),
    },
}

LATE_NIGHT_SIGNAL_THRESHOLD = 0.15
NUDGE_WINDOW_START = "21:15"
NUDGE_WINDOW_END = "21:30"


def build_nudge(
    risk_score: float,
    contributors: list[dict],
    tone: str = "balanced",
    late_night_ratio: float = 0.0,
) -> dict:
    """
    Relapse-window nudge from top risk contributor, phrased in the user's chosen coach tone.

    The specific evening time window is only claimed when the user's own tracked
    late_night_ratio actually shows that pattern — otherwise a generic, time-free
    message is used so the nudge never asserts a personal pattern it can't back up.
    """
    tone = tone if tone in ("gentle", "direct", "balanced") else "balanced"
    has_late_night_signal = late_night_ratio >= LATE_NIGHT_SIGNAL_THRESHOLD

    if risk_score >= 0.6:
        key = "high_risk" if has_late_night_signal else "high_risk_generic"
    elif any(c["feature"] == "compulsive_check_count" for c in contributors):
        key = "compulsive" if has_late_night_signal else "compulsive_generic"
    else:
        key = "manageable" if has_late_night_signal else "manageable_generic"

    window_start = NUDGE_WINDOW_START if has_late_night_signal else ""
    window_end = NUDGE_WINDOW_END if has_late_night_signal else ""
    message = NUDGE_TEMPLATES[key][tone].format(window_start=window_start or "this evening")

    return {"message": message, "window_start": window_start, "window_end": window_end}
