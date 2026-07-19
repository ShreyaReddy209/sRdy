import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { todayKey } from '../lib/dates'
import type { DailyAggregate, DailyGoal } from '../types/dashboard'

export type CoachTone = 'gentle' | 'direct' | 'balanced'

export interface UserProfile {
  email: string
  displayName: string
  onboardingComplete: boolean
  coachTone: CoachTone
  createdAt?: Timestamp
}

function requireDb() {
  if (!db) throw new Error('Firebase is not configured — add your keys to frontend/.env')
  return db
}

export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
): Promise<void> {
  await setDoc(doc(requireDb(), 'users', uid), {
    email,
    displayName,
    onboardingComplete: false,
    createdAt: serverTimestamp(),
    settings: {
      nudgeEnabled: true,
      focusModeDefault: false,
      coachTone: 'balanced',
    },
  })
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(requireDb(), 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    onboardingComplete: Boolean(data.onboardingComplete),
    coachTone: (data.settings?.coachTone as CoachTone) ?? 'balanced',
    createdAt: data.createdAt,
  }
}

export async function setCoachTone(uid: string, tone: CoachTone): Promise<void> {
  await updateDoc(doc(requireDb(), 'users', uid), { 'settings.coachTone': tone })
}

export async function completeOnboarding(uid: string): Promise<void> {
  await setDoc(doc(requireDb(), 'users', uid), { onboardingComplete: true }, { merge: true })
}

export async function setDailyGoal(uid: string, goal: DailyGoal, date = todayKey()): Promise<void> {
  await setDoc(doc(requireDb(), 'users', uid, 'dailyGoals', date), {
    goal,
    setAt: serverTimestamp(),
  })
}

export async function getDailyGoal(uid: string, date = todayKey()): Promise<DailyGoal | null> {
  const snap = await getDoc(doc(requireDb(), 'users', uid, 'dailyGoals', date))
  if (!snap.exists()) return null
  return (snap.data().goal as DailyGoal) ?? null
}

export async function saveCheckIn(
  uid: string,
  scores: { mood: number; stress: number; sleep: number },
  date = todayKey(),
): Promise<void> {
  await setDoc(doc(requireDb(), 'users', uid, 'checkIns', date), {
    moodScore: scores.mood,
    stressScore: scores.stress,
    sleepQuality: scores.sleep,
    completedAt: serverTimestamp(),
  })
}

export async function getCheckIn(
  uid: string,
  date = todayKey(),
): Promise<{ mood: number; stress: number; sleep: number } | null> {
  const snap = await getDoc(doc(requireDb(), 'users', uid, 'checkIns', date))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    mood: d.moodScore ?? 3,
    stress: d.stressScore ?? 3,
    sleep: d.sleepQuality ?? 3,
  }
}

/** Written by the browser extension roughly once a minute. */
export async function getDailyAggregate(
  uid: string,
  date = todayKey(),
): Promise<DailyAggregate | null> {
  const snap = await getDoc(doc(requireDb(), 'users', uid, 'dailyAggregates', date))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    timeByCategory: d.timeByCategory ?? {},
    compulsiveCheckCount: d.compulsiveCheckCount ?? 0,
    tabSwitchFrequency: d.tabSwitchFrequency ?? 0,
    lateNightRatio: d.lateNightRatio ?? 0,
    activeIdleRatio: d.activeIdleRatio ?? 0.5,
    avgSessionLengthMin: d.avgSessionLengthMin ?? 0,
    goalAlignmentScore: d.goalAlignmentScore ?? 0.5,
    totalActiveMinutes: d.totalActiveMinutes ?? 0,
  }
}

function aggregateFromDoc(d: Record<string, unknown>): DailyAggregate {
  return {
    timeByCategory: (d.timeByCategory as Record<string, number>) ?? {},
    compulsiveCheckCount: (d.compulsiveCheckCount as number) ?? 0,
    tabSwitchFrequency: (d.tabSwitchFrequency as number) ?? 0,
    lateNightRatio: (d.lateNightRatio as number) ?? 0,
    activeIdleRatio: (d.activeIdleRatio as number) ?? 0.5,
    avgSessionLengthMin: (d.avgSessionLengthMin as number) ?? 0,
    goalAlignmentScore: (d.goalAlignmentScore as number) ?? 0.5,
    totalActiveMinutes: (d.totalActiveMinutes as number) ?? 0,
  }
}

/** Keyed by YYYY-MM-DD. */
export async function getRecentAggregates(
  uid: string,
  days = 14,
): Promise<Record<string, DailyAggregate>> {
  const q = query(collection(requireDb(), 'users', uid, 'dailyAggregates'), orderBy(documentId(), 'desc'), limit(days))
  const snap = await getDocs(q)
  const out: Record<string, DailyAggregate> = {}
  snap.forEach((d) => {
    out[d.id] = aggregateFromDoc(d.data())
  })
  return out
}

export interface PredictionRecord {
  riskLevel: string
  riskScore: number
  forecast: number[]
  contributors: { feature: string; label: string; impact: number; direction: string }[]
  explanation: string
  nudge: { message: string; windowStart: string; windowEnd: string }
  cohortPercentile: number | null
}

/** Best-effort history write — never blocks or breaks the UI if it fails (e.g. rules not published yet). */
export async function savePrediction(
  uid: string,
  prediction: PredictionRecord,
  date = todayKey(),
): Promise<void> {
  try {
    await setDoc(doc(requireDb(), 'users', uid, 'predictions', date), {
      riskLevel: prediction.riskLevel,
      riskScore: prediction.riskScore,
      forecast: prediction.forecast,
      topContributors: prediction.contributors,
      explanation: prediction.explanation,
      nudge: {
        message: prediction.nudge.message,
        windowStart: prediction.nudge.windowStart,
        windowEnd: prediction.nudge.windowEnd,
      },
      cohortPercentile: prediction.cohortPercentile,
      modelVersion: 'lstm_v1',
      generatedAt: serverTimestamp(),
    })
  } catch {
    /* history persistence is best-effort, never surfaced to the user */
  }
}

/** Keyed by YYYY-MM-DD. */
export async function getRecentCheckIns(
  uid: string,
  days = 14,
): Promise<Record<string, { mood: number; stress: number; sleep: number }>> {
  const q = query(collection(requireDb(), 'users', uid, 'checkIns'), orderBy(documentId(), 'desc'), limit(days))
  const snap = await getDocs(q)
  const out: Record<string, { mood: number; stress: number; sleep: number }> = {}
  snap.forEach((d) => {
    const data = d.data()
    out[d.id] = {
      mood: data.moodScore ?? 3,
      stress: data.stressScore ?? 3,
      sleep: data.sleepQuality ?? 3,
    }
  })
  return out
}
