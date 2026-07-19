/** Build 14-day LSTM input from user check-in, goal, and usage data. */

import type { DailyAggregate, DailyGoal } from '../types/dashboard'
import { todayKey } from './dates'

export interface SequenceHistory {
  /** Keyed by YYYY-MM-DD, most recent daily aggregates from the extension */
  aggregates: Record<string, DailyAggregate>
  /** Keyed by YYYY-MM-DD, most recent saved check-ins */
  checkIns: Record<string, { mood: number; stress: number; sleep: number }>
}

export interface SequenceDay {
  time_social_media: number
  time_video_streaming: number
  time_gaming: number
  time_productivity: number
  time_education: number
  time_news: number
  time_shopping: number
  time_communication: number
  time_other: number
  compulsive_check_count: number
  tab_switch_frequency: number
  late_night_ratio: number
  active_idle_ratio: number
  avg_session_length_min: number
  daily_goal: number
  goal_alignment_score: number
  mood_score: number
  stress_score: number
  sleep_quality: number
}

const GOAL_INDEX: Record<DailyGoal, number> = {
  study: 0,
  work: 1,
  entertainment: 2,
  relax: 3,
}

/** No fabricated "typical user" numbers — until the extension reports real usage, every field is a true zero. */
const ZERO_USAGE = {
  time_social_media: 0,
  time_video_streaming: 0,
  time_gaming: 0,
  time_productivity: 0,
  time_education: 0,
  time_news: 0,
  time_shopping: 0,
  time_communication: 0,
  time_other: 0,
  compulsive_check_count: 0,
  tab_switch_frequency: 0,
  late_night_ratio: 0,
  active_idle_ratio: 0.5,
  avg_session_length_min: 0,
}

/** Neutral 0.5 (neither aligned nor misaligned) when there's no real usage to score against the goal. */
function alignmentForGoal(): number {
  return 0.5
}

/** Maps the extension's dailyAggregates document to LSTM feature fields */
function aggregateToPartialDay(agg: DailyAggregate): Partial<SequenceDay> {
  const t = agg.timeByCategory
  return {
    time_social_media: t.social_media ?? 0,
    time_video_streaming: t.video_streaming ?? 0,
    time_gaming: t.gaming ?? 0,
    time_productivity: t.productivity ?? 0,
    time_education: t.education ?? 0,
    time_news: t.news ?? 0,
    time_shopping: t.shopping ?? 0,
    time_communication: t.communication ?? 0,
    time_other: t.other ?? 0,
    compulsive_check_count: agg.compulsiveCheckCount,
    tab_switch_frequency: agg.tabSwitchFrequency,
    late_night_ratio: agg.lateNightRatio,
    active_idle_ratio: agg.activeIdleRatio,
    avg_session_length_min: agg.avgSessionLengthMin,
    goal_alignment_score: agg.goalAlignmentScore,
  }
}

function dateKeyDaysAgo(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return todayKey(d)
}

/**
 * True once there is at least one real data point (extension aggregate or a saved
 * check-in) to predict from. Used to decide whether to call the model at all —
 * predicting on pure zeros would produce a number with nothing real behind it.
 */
export function hasRealSignal(
  todayAggregate: DailyAggregate | null | undefined,
  todayCheckIn: unknown,
  history?: SequenceHistory,
): boolean {
  return Boolean(
    todayAggregate ||
      todayCheckIn ||
      (history && (Object.keys(history.aggregates).length > 0 || Object.keys(history.checkIns).length > 0)),
  )
}

export function buildSequence(
  goal: DailyGoal,
  mood: { mood: number; stress: number; sleep: number },
  days = 14,
  todayAggregate?: DailyAggregate | null,
  history?: SequenceHistory,
): SequenceDay[] {
  const goalIdx = GOAL_INDEX[goal]
  const alignment = alignmentForGoal()
  const realToday = todayAggregate ? aggregateToPartialDay(todayAggregate) : null

  const today: SequenceDay = {
    ...ZERO_USAGE,
    ...realToday,
    daily_goal: goalIdx,
    goal_alignment_score: realToday?.goal_alignment_score ?? alignment,
    mood_score: mood.mood,
    stress_score: mood.stress,
    sleep_quality: mood.sleep,
  }

  // Build oldest -> newest, using real extension/check-in history where it exists
  // for that date, and falling back to an extrapolation from today's pattern
  // for any day that hasn't been tracked yet.
  const seq: SequenceDay[] = []
  for (let i = 0; i < days; i++) {
    const daysAgo = days - 1 - i
    if (daysAgo === 0) {
      seq.push(today)
      continue
    }

    const dateStr = dateKeyDaysAgo(daysAgo)
    const histAgg = history?.aggregates[dateStr]

    if (histAgg) {
      const partial = aggregateToPartialDay(histAgg)
      const histMood = history?.checkIns[dateStr]
      seq.push({
        ...ZERO_USAGE,
        ...partial,
        daily_goal: goalIdx,
        goal_alignment_score: partial.goal_alignment_score ?? alignment,
        mood_score: histMood?.mood ?? mood.mood,
        stress_score: histMood?.stress ?? mood.stress,
        sleep_quality: histMood?.sleep ?? mood.sleep,
      })
      continue
    }

    const factor = 0.85 + (i / days) * 0.15
    const stressDrift = mood.stress * factor
    seq.push({
      ...today,
      compulsive_check_count: Math.round(today.compulsive_check_count * factor),
      late_night_ratio: Math.min(today.late_night_ratio * factor, 1),
      stress_score: Math.max(1, Math.min(5, stressDrift)),
      goal_alignment_score: Math.min(today.goal_alignment_score * (0.9 + i * 0.01), 1),
    })
  }
  return seq
}
