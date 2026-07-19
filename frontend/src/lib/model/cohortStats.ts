/**
 * Cohort benchmarking against the synthetic population dataset — ported from
 * backend/app/cohort.py + insights.py. The dataset itself doesn't change, so its
 * summary statistics are precomputed once (ml/export_for_browser.py) and shipped
 * as a small static JSON asset instead of a live Python process.
 */

export interface PopulationInsight {
  highStressAvgMin: number
  lowStressAvgMin: number
  pctDiff: number
  sampleSize: number
}

interface CohortStatsFile {
  sorted_scores: number[]
  mood_usage: {
    high_stress_avg_min: number
    low_stress_avg_min: number
    pct_diff: number
    sample_size: number
  } | null
}

let cached: Promise<{ sortedScores: number[]; moodUsage: PopulationInsight | null }> | null = null

function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base.endsWith('/') ? base : `${base}/`}model/${path}`
}

async function load() {
  if (!cached) {
    cached = (async () => {
      try {
        const res = await fetch(assetUrl('cohort_stats.json'))
        if (!res.ok) return { sortedScores: [], moodUsage: null }
        const data: CohortStatsFile = await res.json()
        const moodUsage = data.mood_usage
          ? {
              highStressAvgMin: data.mood_usage.high_stress_avg_min,
              lowStressAvgMin: data.mood_usage.low_stress_avg_min,
              pctDiff: data.mood_usage.pct_diff,
              sampleSize: data.mood_usage.sample_size,
            }
          : null
        return { sortedScores: data.sorted_scores ?? [], moodUsage }
      } catch {
        return { sortedScores: [], moodUsage: null }
      }
    })()
  }
  return cached
}

/** % of the cohort with an equal-or-higher risk score (higher = user is doing better). */
export async function percentileBetterThan(riskScore: number): Promise<number | null> {
  const { sortedScores } = await load()
  if (sortedScores.length === 0) return null

  let lo = 0
  let hi = sortedScores.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sortedScores[mid] < riskScore) lo = mid + 1
    else hi = mid
  }
  const countAtOrAbove = sortedScores.length - lo
  return Math.round((countAtOrAbove / sortedScores.length) * 1000) / 10
}

export async function fetchPopulationInsight(): Promise<PopulationInsight | null> {
  const { moodUsage } = await load()
  return moodUsage
}
