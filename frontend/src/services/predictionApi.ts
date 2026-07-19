/**
 * Prediction "API" — runs entirely client-side via TensorFlow.js (see lib/model/).
 * Kept the same function signatures as the old backend-fetch version so nothing
 * else in the app needs to change: same LSTM model, same explain/nudge logic,
 * same cohort dataset — just executed in the browser instead of a Python server.
 */
import type { Contributor, DailyAggregate, DailyGoal, RiskLevel } from '../types/dashboard'
import type { CoachTone } from './userData'
import { buildSequence, type SequenceHistory } from '../lib/buildSequence'
import { loadModel, runPrediction } from '../lib/model/predict'
import { fetchPopulationInsight as fetchCohortMoodUsage, percentileBetterThan } from '../lib/model/cohortStats'

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
  const result = await runPrediction(sequence, goal, coachTone)
  const cohortPercentile = await percentileBetterThan(result.riskScore)

  return {
    riskLevel: result.riskLevel as RiskLevel,
    riskScore: result.riskScore,
    forecast: result.forecast.map((score, i) => ({
      day: FORECAST_LABELS[i] ?? `T+${i}`,
      score,
    })),
    explanation: result.explanation,
    contributors: result.contributors,
    nudge: {
      message: result.nudge.message,
      windowStart: result.nudge.window_start,
      windowEnd: result.nudge.window_end,
    },
    cohortPercentile,
  }
}

export async function fetchPopulationInsight(): Promise<PopulationInsight | null> {
  return fetchCohortMoodUsage()
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    await loadModel()
    return true
  } catch {
    return false
  }
}
