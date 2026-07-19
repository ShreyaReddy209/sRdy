/**
 * Plain-language explanations from feature attributions.
 * Direct TypeScript port of backend/app/explain.py — same logic, same thresholds,
 * same templates — so moving inference client-side changes nothing about the output.
 */
import type { Contributor } from '../types/dashboard'

export type CoachTone = 'gentle' | 'direct' | 'balanced'

const FEATURE_LABELS: Record<string, string> = {
  time_social_media: 'Social media time',
  time_video_streaming: 'Video streaming time',
  time_gaming: 'Gaming time',
  time_productivity: 'Productivity app time',
  time_education: 'Education site time',
  compulsive_check_count: 'Compulsive tab checks',
  tab_switch_frequency: 'Tab switching frequency',
  late_night_ratio: 'Late-night usage',
  goal_alignment_score: 'Goal alignment',
  mood_score: 'Mood level',
  stress_score: 'Stress level',
  sleep_quality: 'Sleep quality',
}

const RISK_UP_FEATURES = new Set([
  'time_social_media',
  'time_video_streaming',
  'time_gaming',
  'compulsive_check_count',
  'tab_switch_frequency',
  'late_night_ratio',
  'stress_score',
])

export function computeContributors(
  lastDay: number[],
  baseline: number[],
  featureNames: string[],
  topK = 5,
): Contributor[] {
  let scores: { name: string; impact: number; direction: 'up' | 'down' }[] = []

  for (let i = 0; i < featureNames.length; i++) {
    const name = featureNames[i]
    if (!(name in FEATURE_LABELS)) continue
    const diff = lastDay[i] - baseline[i]
    if (Math.abs(diff) < 1e-6) continue

    let direction: 'up' | 'down'
    let impact: number

    if (name === 'goal_alignment_score') {
      direction = diff < 0 ? 'up' : 'down'
      impact = Math.min(Math.abs(diff) / Math.max(baseline[i], 0.1), 1.0)
    } else if (RISK_UP_FEATURES.has(name)) {
      direction = diff > 0 ? 'up' : 'down'
      impact = Math.min(Math.abs(diff) / Math.max(Math.abs(baseline[i]), 1.0), 1.0)
    } else if (name === 'mood_score' || name === 'sleep_quality') {
      direction = diff < 0 ? 'up' : 'down'
      impact = Math.min(Math.abs(diff) / 5.0, 1.0)
    } else {
      continue
    }

    if (impact < 0.05) continue
    scores.push({ name, impact, direction })
  }

  scores.sort((a, b) => b.impact - a.impact)

  if (scores.length === 0) {
    for (let i = 0; i < featureNames.length; i++) {
      const name = featureNames[i]
      if (!(name in FEATURE_LABELS)) continue
      const val = lastDay[i]
      if (RISK_UP_FEATURES.has(name) && val > 0) {
        const impact = Math.min(name.startsWith('time_') ? val / 100.0 : val / 40.0, 1.0)
        if (impact > 0.05) scores.push({ name, impact, direction: 'up' })
      } else if (name === 'goal_alignment_score' && val < 0.6) {
        scores.push({ name, impact: 1.0 - val, direction: 'down' })
      }
    }
    scores.sort((a, b) => b.impact - a.impact)
  }

  const top = scores.slice(0, topK)
  const total = top.reduce((s, c) => s + c.impact, 0) || 1.0

  return top.map((c) => ({
    feature: c.name,
    label: FEATURE_LABELS[c.name] ?? c.name,
    impact: Math.round((c.impact / total) * 100) / 100,
    direction: c.direction,
  }))
}

export function buildExplanation(
  riskLevel: string,
  riskScore: number,
  contributors: Contributor[],
  goalLabel: string,
  lastDay: number[],
  featureNames: string[],
): string {
  const idx = new Map(featureNames.map((n, i) => [n, i]))
  const parts: string[] = []

  parts.push(
    `Your behavioral risk is ${riskLevel} (${Math.floor(riskScore * 100)}%) based on the last 14 days of patterns.`,
  )

  if (contributors.length > 0) {
    const top = contributors[0]
    parts.push(
      `The strongest signal is ${top.label.toLowerCase()} ` +
        `(${top.direction === 'up' ? 'pushing risk up' : 'helping keep risk down'}).`,
    )
  }

  const checksIdx = idx.get('compulsive_check_count')
  if (checksIdx !== undefined) {
    const checks = Math.floor(lastDay[checksIdx])
    if (checks > 25) {
      parts.push(`You had ${checks} short tab-check sessions today, which often indicates compulsive checking.`)
    }
  }

  const lateIdx = idx.get('late_night_ratio')
  if (lateIdx !== undefined) {
    const late = lastDay[lateIdx]
    if (late > 0.35) {
      parts.push(`About ${Math.floor(late * 100)}% of usage happened after 11 PM.`)
    }
  }

  const alignIdx = idx.get('goal_alignment_score')
  if (alignIdx !== undefined) {
    const align = lastDay[alignIdx]
    parts.push(`With a ${goalLabel} goal, only ${Math.floor(align * 100)}% of your screen time aligned with that intent.`)
  }

  return parts.join(' ')
}

const NUDGE_TEMPLATES: Record<string, Record<CoachTone, string>> = {
  high_risk: {
    gentle:
      "Today's been a heavier screen day, and that's okay. Your own recent activity shows a real pattern " +
      'of being active late in the evening — maybe try a gentle 5-minute pause around {window_start}, ' +
      'just to check in with yourself.',
    direct:
      "Risk is high. Your tracked usage shows you're typically still active around {window_start}. " +
      'Take a 5-minute break then — no excuses tonight.',
    balanced:
      'Your risk is trending high. Your tracked usage shows a real late-evening pattern around ' +
      '{window_start}. Try a 5-minute break then — it may prevent another high-risk evening.',
  },
  high_risk_generic: {
    gentle:
      "Today's been a heavier screen day, and that's okay. A short, gentle pause sometime today — even " +
      'just 5 minutes — could help before it builds further.',
    direct: 'Risk is high today. Take a 5-minute break now and reset before it builds further.',
    balanced: 'Your risk is trending high today. A short break now could help prevent it from building further.',
  },
  compulsive: {
    gentle:
      "Looks like you've been checking tabs a lot today — totally normal when things feel stressful. " +
      'Your tracked activity shows this tends to happen later in the evening, around {window_start} — ' +
      'maybe close a few tabs then and pick one thing to focus on.',
    direct:
      'Too much tab-switching today, usually picking up again around {window_start}. ' +
      'Close non-essential tabs now and lock in one task.',
    balanced:
      'Frequent tab-checking is driving your score, and your tracked activity shows it tends to happen ' +
      'around {window_start}. Close non-essential tabs and set a single focus task before then.',
  },
  compulsive_generic: {
    gentle:
      "Looks like you've been checking tabs a lot today — totally normal when things feel stressful. " +
      'Closing a few tabs now and picking one thing to focus on could help.',
    direct: 'Too much tab-switching today. Close non-essential tabs now and lock in one task.',
    balanced:
      'Frequent tab-checking is driving your score today. Closing non-essential tabs and setting a ' +
      'single focus task could help.',
  },
  manageable: {
    gentle:
      "You're doing well today. Your tracked activity shows you're sometimes still online around " +
      '{window_start} — a short, kind check-in with yourself around then could help you keep this going.',
    direct: 'Patterns are fine. Do a quick check-in around {window_start} and stay on track.',
    balanced:
      "Patterns look manageable. Your tracked activity shows you're sometimes still online around " +
      '{window_start} — a short check-in then can help you stay on track with your stated goal.',
  },
  manageable_generic: {
    gentle: "You're doing well today. A short, kind check-in with yourself later could help you keep this going.",
    direct: 'Patterns are fine. Do a quick check-in later today and stay on track.',
    balanced:
      'Patterns look manageable today. A short check-in later can help you stay on track with your ' + 'stated goal.',
  },
}

const LATE_NIGHT_SIGNAL_THRESHOLD = 0.15
const NUDGE_WINDOW_START = '21:15'
const NUDGE_WINDOW_END = '21:30'

export interface Nudge {
  message: string
  window_start: string
  window_end: string
}

/**
 * Relapse-window nudge from top risk contributor, phrased in the user's chosen coach tone.
 *
 * The specific evening time window is only claimed when the user's own tracked
 * late_night_ratio actually shows that pattern — otherwise a generic, time-free
 * message is used so the nudge never asserts a personal pattern it can't back up.
 */
export function buildNudge(
  riskScore: number,
  contributors: Contributor[],
  tone: CoachTone = 'balanced',
  lateNightRatio = 0.0,
): Nudge {
  const safeTone: CoachTone = ['gentle', 'direct', 'balanced'].includes(tone) ? tone : 'balanced'
  const hasLateNightSignal = lateNightRatio >= LATE_NIGHT_SIGNAL_THRESHOLD

  let key: string
  if (riskScore >= 0.6) {
    key = hasLateNightSignal ? 'high_risk' : 'high_risk_generic'
  } else if (contributors.some((c) => c.feature === 'compulsive_check_count')) {
    key = hasLateNightSignal ? 'compulsive' : 'compulsive_generic'
  } else {
    key = hasLateNightSignal ? 'manageable' : 'manageable_generic'
  }

  const windowStart = hasLateNightSignal ? NUDGE_WINDOW_START : ''
  const windowEnd = hasLateNightSignal ? NUDGE_WINDOW_END : ''
  const message = NUDGE_TEMPLATES[key][safeTone].replaceAll('{window_start}', windowStart || 'this evening')

  return { message, window_start: windowStart, window_end: windowEnd }
}
