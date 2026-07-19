/**
 * Client-side LSTM inference — direct TypeScript port of backend/app/predictor.py's
 * predict(). Same padding, same scaling, same argmax, same contributor/explanation/
 * nudge logic. This is what lets the whole app run without any backend process.
 */
import * as tf from '@tensorflow/tfjs'
import { loadModel } from './lstmModel'
import { computeContributors, buildExplanation, buildNudge, type CoachTone, type Nudge } from '../explain'
import type { Contributor } from '../../types/dashboard'
import type { SequenceDay } from '../buildSequence'

export interface RawPrediction {
  riskLevel: string
  riskScore: number
  forecast: number[]
  explanation: string
  contributors: Contributor[]
  nudge: Nudge
}

function dayToVector(day: SequenceDay): number[] {
  return [
    day.time_social_media,
    day.time_video_streaming,
    day.time_gaming,
    day.time_productivity,
    day.time_education,
    day.time_news,
    day.time_shopping,
    day.time_communication,
    day.time_other,
    day.compulsive_check_count,
    day.tab_switch_frequency,
    day.late_night_ratio,
    day.active_idle_ratio,
    day.avg_session_length_min,
    day.daily_goal,
    day.goal_alignment_score,
    day.mood_score,
    day.stress_score,
    day.sleep_quality,
  ]
}

function padSequence(vectors: number[][], seqLen: number, numFeatures: number): number[][] {
  if (vectors.length >= seqLen) return vectors.slice(vectors.length - seqLen)
  if (vectors.length === 0) return Array.from({ length: seqLen }, () => new Array(numFeatures).fill(0))

  const pad = Array.from({ length: seqLen - vectors.length }, () => vectors[0])
  return [...pad, ...vectors]
}

function meanVector(vectors: number[][], numFeatures: number): number[] {
  if (vectors.length === 0) return new Array(numFeatures).fill(0)
  const sum = new Array(numFeatures).fill(0)
  for (const v of vectors) {
    for (let i = 0; i < numFeatures; i++) sum[i] += v[i]
  }
  return sum.map((s) => s / vectors.length)
}

export async function runPrediction(
  sequence: SequenceDay[],
  goalLabel: string,
  coachTone: CoachTone,
): Promise<RawPrediction> {
  const { model, meta, scalerMean, scalerScale } = await loadModel()
  const seqLen = meta.sequence_length
  const numFeatures = meta.num_features

  const raw = padSequence(sequence.map(dayToVector), seqLen, numFeatures)
  const scaled = raw.map((v) => v.map((val, i) => (val - scalerMean[i]) / scalerScale[i]))

  const inputTensor = tf.tensor3d([scaled])
  const outputs = model.predict(inputTensor) as tf.Tensor[]
  const [classProbsT, riskScoreT, forecastT] = outputs
  const [classProbs, riskScoreArr, forecastArr] = await Promise.all([
    classProbsT.data(),
    riskScoreT.data(),
    forecastT.data(),
  ])
  tf.dispose([inputTensor, ...outputs])

  let classIdx = 0
  for (let i = 1; i < classProbs.length; i++) {
    if (classProbs[i] > classProbs[classIdx]) classIdx = i
  }
  const riskLevel = meta.risk_levels[classIdx]
  const score = riskScoreArr[0]
  const forecast = Array.from(forecastArr)

  const lastDay = raw[raw.length - 1]
  const baseline = raw.length > 1 ? meanVector(raw.slice(0, -1), numFeatures) : raw[0]

  const contributors = computeContributors(lastDay, baseline, meta.feature_names)
  const explanation = buildExplanation(riskLevel, score, contributors, goalLabel, lastDay, meta.feature_names)

  const lateNightIdx = meta.feature_names.indexOf('late_night_ratio')
  const lateNightRatio = lateNightIdx >= 0 ? lastDay[lateNightIdx] : 0
  const nudge = buildNudge(score, contributors, coachTone, lateNightRatio)

  return {
    riskLevel,
    riskScore: Math.round(score * 10000) / 10000,
    forecast,
    explanation,
    contributors,
    nudge,
  }
}

export { loadModel }
