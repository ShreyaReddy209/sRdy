import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { useUserProfile } from './UserProfileContext'
import { DEFAULT_DAILY_GOAL, DEFAULT_MOOD, EMPTY_DASHBOARD } from '../types/dashboard'
import {
  getCheckIn,
  getDailyAggregate,
  getDailyGoal,
  getRecentAggregates,
  getRecentCheckIns,
  saveCheckIn,
  savePrediction,
  setCoachTone as persistCoachTone,
  setDailyGoal,
  type CoachTone,
} from '../services/userData'
import { fetchPopulationInsight, fetchPrediction, type PredictionResult } from '../services/predictionApi'
import { aggregateToCategoryList } from '../lib/categories'
import { todayKey } from '../lib/dates'
import { hasRealSignal, type SequenceHistory } from '../lib/buildSequence'
import { personalizeMoodUsage, type MoodUsageInsight as MoodUsageInsightData } from '../lib/moodUsageInsight'
import type { DailyAggregate, DailyGoal, DashboardData } from '../types/dashboard'

const EMPTY_HISTORY: SequenceHistory = { aggregates: {}, checkIns: {} }

/** 'no-data' = nothing real to predict from yet (no extension activity, no check-in ever) */
type PredictionStatus = 'no-data' | 'loading' | 'live' | 'fallback' | 'error'
type CheckInStatus = 'idle' | 'saving' | 'saved' | 'error'

function computeStreak(checkIns: Record<string, unknown>): number {
  let streak = 0
  const d = new Date()
  while (checkIns[todayKey(d)]) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function nudgeReadKey(uid: string): string {
  return `wellsense_nudge_read_${uid}_${todayKey()}`
}

interface DashboardContextValue {
  data: DashboardData
  loadingUserData: boolean
  predictionStatus: PredictionStatus
  checkInStatus: CheckInStatus
  aggregate: DailyAggregate | null
  coachTone: CoachTone
  moodInsight: MoodUsageInsightData | null
  statusMessage: string
  nudgeRead: boolean
  hasLiveData: boolean
  handleGoalSelect: (goal: DailyGoal) => void
  handleMoodChange: (field: 'mood' | 'stress' | 'sleep', value: number) => void
  handleToneChange: (tone: CoachTone) => void
  markNudgeRead: () => void
}

const DashboardDataContext = createContext<DashboardContextValue | null>(null)

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD)
  const [loadingUserData, setLoadingUserData] = useState(true)
  const [predictionStatus, setPredictionStatus] = useState<PredictionStatus>('loading')
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus>('idle')
  const [aggregate, setAggregate] = useState<DailyAggregate | null>(null)
  const [coachTone, setCoachTone] = useState<CoachTone>('balanced')
  const [moodInsight, setMoodInsight] = useState<MoodUsageInsightData | null>(null)
  const [history, setHistory] = useState<SequenceHistory>(EMPTY_HISTORY)
  const [nudgeRead, setNudgeReadState] = useState(false)
  const [hasLiveData, setHasLiveData] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const predictTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef({ goal: data.dailyGoal, mood: data.mood, tone: coachTone, history })

  useEffect(() => {
    if (profile) setCoachTone(profile.coachTone)
  }, [profile])

  useEffect(() => {
    latestRef.current = { goal: data.dailyGoal, mood: data.mood, tone: coachTone, history }
  }, [data.dailyGoal, data.mood, coachTone, history])

  useEffect(() => {
    if (!user) {
      setNudgeReadState(false)
      return
    }
    setNudgeReadState(localStorage.getItem(nudgeReadKey(user.uid)) === '1')
  }, [user])

  function markNudgeRead() {
    if (!user) return
    localStorage.setItem(nudgeReadKey(user.uid), '1')
    setNudgeReadState(true)
  }

  const runPrediction = useCallback(
    async (
      goal: DailyGoal,
      mood: { mood: number; stress: number; sleep: number },
      agg?: DailyAggregate | null,
      tone: CoachTone = 'balanced',
      hist?: SequenceHistory,
    ) => {
      setPredictionStatus('loading')
      try {
        const result: PredictionResult = await fetchPrediction(goal, mood, agg, tone, hist)
        setData((d) => ({
          ...d,
          riskLevel: result.riskLevel,
          riskScore: result.riskScore,
          forecast: result.forecast,
          explanation: result.explanation,
          contributors: result.contributors,
          nudge: result.nudge,
          cohortPercentile: result.cohortPercentile,
        }))
        setPredictionStatus('live')
        setHasLiveData(true)
        if (user) {
          savePrediction(user.uid, {
            riskLevel: result.riskLevel,
            riskScore: result.riskScore,
            forecast: result.forecast.map((f) => f.score),
            contributors: result.contributors,
            explanation: result.explanation,
            nudge: result.nudge,
            cohortPercentile: result.cohortPercentile,
          }).catch(() => {
            /* history persistence is best-effort */
          })
        }
      } catch {
        setPredictionStatus('fallback')
      }
    },
    [user],
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      if (!user) return
      setLoadingUserData(true)
      try {
        const [goal, checkIn, agg, recentAggs, recentCheckIns, populationInsight] = await Promise.all([
          getDailyGoal(user.uid),
          getCheckIn(user.uid),
          getDailyAggregate(user.uid),
          getRecentAggregates(user.uid),
          getRecentCheckIns(user.uid),
          fetchPopulationInsight(),
        ])
        if (cancelled) return
        const dailyGoal = goal ?? DEFAULT_DAILY_GOAL
        const mood = checkIn ?? DEFAULT_MOOD
        const tone = profile?.coachTone ?? 'balanced'
        const hist: SequenceHistory = { aggregates: recentAggs, checkIns: recentCheckIns }
        setAggregate(agg)
        setHistory(hist)

        const streakCheckIns = checkIn ? { ...recentCheckIns, [todayKey()]: checkIn } : recentCheckIns
        setData((d) => ({
          ...d,
          dailyGoal,
          mood,
          streakDays: computeStreak(streakCheckIns),
          categoryBreakdown: agg ? aggregateToCategoryList(agg.timeByCategory) : d.categoryBreakdown,
        }))

        const personalized = personalizeMoodUsage(recentCheckIns, recentAggs)
        if (personalized) {
          setMoodInsight(personalized)
        } else if (populationInsight) {
          setMoodInsight({
            highStressAvgMin: populationInsight.highStressAvgMin,
            lowStressAvgMin: populationInsight.lowStressAvgMin,
            pctDiff: populationInsight.pctDiff,
            sampleSize: populationInsight.sampleSize,
            personalized: false,
          })
        }

        if (hasRealSignal(agg, checkIn, hist)) {
          await runPrediction(dailyGoal, mood, agg, tone, hist)
        } else {
          // Nothing real to predict from yet — an honest empty state beats a score computed from zeros.
          setPredictionStatus('no-data')
        }
      } finally {
        if (!cancelled) setLoadingUserData(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // profile.coachTone intentionally excluded — handled by handleToneChange to avoid double-fetching
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, runPrediction])

  // Keeps the dashboard in sync with the extension without needing a manual page reload.
  // Polls a bit faster than the extension's ~60s sync interval so new data shows up quickly.
  useEffect(() => {
    if (!user) return

    const interval = setInterval(async () => {
      try {
        const [agg, recentAggs, recentCheckIns] = await Promise.all([
          getDailyAggregate(user.uid),
          getRecentAggregates(user.uid),
          getRecentCheckIns(user.uid),
        ])
        if (!agg) return
        const hist: SequenceHistory = { aggregates: recentAggs, checkIns: recentCheckIns }
        setAggregate(agg)
        setHistory(hist)
        setData((d) => ({ ...d, categoryBreakdown: aggregateToCategoryList(agg.timeByCategory) }))
        const { goal, mood, tone } = latestRef.current
        await runPrediction(goal, mood, agg, tone, hist)
      } catch {
        /* transient network error — retried on the next tick */
      }
    }, 45000)

    return () => clearInterval(interval)
  }, [user, runPrediction])

  function handleGoalSelect(goal: DailyGoal) {
    if (!user) return
    setData((d) => {
      runPrediction(goal, d.mood, aggregate, coachTone, history)
      return { ...d, dailyGoal: goal }
    })
    setDailyGoal(user.uid, goal).catch(() => {
      /* keep optimistic UI */
    })
  }

  function handleMoodChange(field: 'mood' | 'stress' | 'sleep', value: number) {
    if (!user) return

    setData((d) => {
      const mood = { ...d.mood, [field]: value }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (predictTimer.current) clearTimeout(predictTimer.current)
      setCheckInStatus('saving')

      saveTimer.current = setTimeout(async () => {
        try {
          await saveCheckIn(user.uid, mood)
          setCheckInStatus('saved')
          setData((prev) => ({
            ...prev,
            streakDays: computeStreak({ ...history.checkIns, [todayKey()]: mood }),
          }))
          setTimeout(() => setCheckInStatus('idle'), 2000)
        } catch {
          setCheckInStatus('error')
        }
      }, 400)

      predictTimer.current = setTimeout(() => {
        runPrediction(d.dailyGoal, mood, aggregate, coachTone, history)
      }, 600)

      return { ...d, mood }
    })
  }

  function handleToneChange(tone: CoachTone) {
    setCoachTone(tone)
    runPrediction(data.dailyGoal, data.mood, aggregate, tone, history)
    if (user) {
      persistCoachTone(user.uid, tone).catch(() => {
        /* keep optimistic UI */
      })
    }
  }

  const statusMessage = {
    'no-data':
      'No prediction yet — complete a check-in or install the browser extension so there is real activity to analyze.',
    loading: 'Running LSTM prediction…',
    live: aggregate
      ? 'Risk score and forecast from the LSTM model, using real usage data from your browser extension.'
      : 'Risk score and forecast from the LSTM model, based on your check-in only (install the browser extension to include real usage data).',
    fallback: 'Backend unreachable — no new prediction could be computed. Start it with: uvicorn app.main:app --reload',
    error: 'Could not load prediction.',
  }[predictionStatus]

  return (
    <DashboardDataContext.Provider
      value={{
        data,
        loadingUserData,
        predictionStatus,
        checkInStatus,
        aggregate,
        coachTone,
        moodInsight,
        statusMessage,
        nudgeRead,
        hasLiveData,
        handleGoalSelect,
        handleMoodChange,
        handleToneChange,
        markNudgeRead,
      }}
    >
      {children}
    </DashboardDataContext.Provider>
  )
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) throw new Error('useDashboardData must be used inside DashboardDataProvider')
  return ctx
}
