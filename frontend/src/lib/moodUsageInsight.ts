import type { DailyAggregate } from '../types/dashboard'

export interface MoodUsageInsight {
  highStressAvgMin: number
  lowStressAvgMin: number
  pctDiff: number
  sampleSize: number
  personalized: boolean
}

function distractionMinutes(agg: DailyAggregate): number {
  const t = agg.timeByCategory
  return (t.social_media ?? 0) + (t.video_streaming ?? 0) + (t.gaming ?? 0)
}

/** Correlates the user's own stress check-ins with their real usage, when enough days exist */
export function personalizeMoodUsage(
  checkIns: Record<string, { mood: number; stress: number; sleep: number }>,
  aggregates: Record<string, DailyAggregate>,
): MoodUsageInsight | null {
  const highStress: number[] = []
  const lowStress: number[] = []

  for (const [date, mood] of Object.entries(checkIns)) {
    const agg = aggregates[date]
    if (!agg) continue
    const minutes = distractionMinutes(agg)
    if (mood.stress >= 4) highStress.push(minutes)
    else if (mood.stress <= 2) lowStress.push(minutes)
  }

  if (highStress.length < 2 || lowStress.length < 2) return null

  const highAvg = highStress.reduce((a, b) => a + b, 0) / highStress.length
  const lowAvg = lowStress.reduce((a, b) => a + b, 0) / lowStress.length
  const pctDiff = lowAvg > 0 ? ((highAvg - lowAvg) / lowAvg) * 100 : 0

  return {
    highStressAvgMin: Math.round(highAvg),
    lowStressAvgMin: Math.round(lowAvg),
    pctDiff: Math.round(pctDiff * 10) / 10,
    sampleSize: highStress.length + lowStress.length,
    personalized: true,
  }
}
