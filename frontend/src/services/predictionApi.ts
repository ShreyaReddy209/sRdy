import type { Contributor, DailyAggregate, DailyGoal, RiskLevel } from '../types/dashboard'
import type { CoachTone } from './userData'
import { buildSequence, type SequenceHistory } from '../lib/buildSequence'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface PredictionResult {
  riskLevel: RiskLevel
  riskScore: number
  forecast: { day: string; score: number }[]
  explanation: string
  contributors: Contributor[]
  nudge: {
    message: string
    windowStart: string
    windowEnd: string
  }
  cohortPercentile: number | null
}

export interface PopulationInsight {
  highStressAvgMin: number
  lowStressAvgMin: number
  pctDiff: number
  sampleSize: number
}

const FORECAST_LABELS = ['Today', 'T+1', 'T+2', 'T+3', 'T+4', 'T+5', 'T+6', 'T+7']

export async function fetchPrediction(
  goal: DailyGoal,
  mood: { mood: number; stress: number; sleep: number },
  todayAggregate?: DailyAggregate | null,
  coachTone: CoachTone = 'balanced',
  history?: SequenceHistory,
): Promise<PredictionResult> {
  const sequence = buildSequence(goal, mood, 14, todayAggregate, history)

  const res = await fetch(`${API_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sequence,
      goal_label: goal,
      coach_tone: coachTone,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `Prediction failed (${res.status})`)
  }

  const data = await res.json()

  return {
    riskLevel: data.risk_level as RiskLevel,
    riskScore: data.risk_score,
    forecast: (data.forecast as number[]).map((score, i) => ({
      day: FORECAST_LABELS[i] ?? `T+${i}`,
      score,
    })),
    explanation: data.explanation,
    contributors: data.contributors,
    nudge: {
      message: data.nudge.message,
      windowStart: data.nudge.window_start,
      windowEnd: data.nudge.window_end,
    },
    cohortPercentile: data.cohort_percentile ?? null,
  }
}

export async function fetchPopulationInsight(): Promise<PopulationInsight | null> {
  try {
    const res = await fetch(`${API_URL}/insights`)
    if (!res.ok) return null
    const data = await res.json()
    const m = data.mood_usage
    if (!m) return null
    return {
      highStressAvgMin: m.high_stress_avg_min,
      lowStressAvgMin: m.low_stress_avg_min,
      pctDiff: m.pct_diff,
      sampleSize: m.sample_size,
    }
  } catch {
    return null
  }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`)
    if (!res.ok) return false
    const data = await res.json()
    return data.model_loaded === true
  } catch {
    return false
  }
}
