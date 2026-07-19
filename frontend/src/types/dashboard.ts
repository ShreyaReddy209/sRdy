export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'
export type DailyGoal = 'study' | 'work' | 'entertainment' | 'relax'

export interface Contributor {
  feature: string
  label: string
  impact: number
  direction: 'up' | 'down'
}

/** One site’s contribution inside a category (from the extension). */
export interface SiteUsage {
  domain: string
  category: string
  minutes: number
}

/** Written by the browser extension every ~1 minute */
export interface DailyAggregate {
  timeByCategory: Record<string, number>
  /** Per-domain minutes + category — used for click-to-expand breakdowns */
  sites: SiteUsage[]
  compulsiveCheckCount: number
  tabSwitchFrequency: number
  lateNightRatio: number
  activeIdleRatio: number
  avgSessionLengthMin: number
  goalAlignmentScore: number
  totalActiveMinutes: number
}

export interface CategoryBreakdownItem {
  /** Stable key e.g. education, other */
  key: string
  category: string
  minutes: number
  color: string
  sites: { domain: string; minutes: number }[]
}

export interface DashboardData {
  riskLevel: RiskLevel
  riskScore: number
  forecast: { day: string; score: number }[]
  categoryBreakdown: CategoryBreakdownItem[]
  contributors: Contributor[]
  explanation: string
  nudge: {
    message: string
    windowStart: string
    windowEnd: string
  }
  dailyGoal: DailyGoal
  mood: { mood: number; stress: number; sleep: number }
  streakDays: number
  cohortPercentile: number | null
}

export const DEFAULT_DAILY_GOAL: DailyGoal = 'study'
export const DEFAULT_MOOD = { mood: 3, stress: 3, sleep: 3 }

/**
 * Genuinely empty state — used only before the backend has returned real data,
 * or when there is nothing to show. Contains no fabricated metrics; every
 * numeric field is zero/null until a real API response overwrites it.
 */
export const EMPTY_DASHBOARD: DashboardData = {
  riskLevel: 'low',
  riskScore: 0,
  forecast: [],
  categoryBreakdown: [],
  contributors: [],
  explanation: '',
  nudge: {
    message: '',
    windowStart: '',
    windowEnd: '',
  },
  dailyGoal: DEFAULT_DAILY_GOAL,
  mood: DEFAULT_MOOD,
  streakDays: 0,
  cohortPercentile: null,
}
