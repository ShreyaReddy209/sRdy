import { categorizeDomain } from './categoryMap.js'
import { firestoreGet, firestoreSet, getValidAuth, signIn, signOutLocal } from './firestoreRest.js'

const TICK_ALARM = 'wellsense-tick'
const COMPULSIVE_THRESHOLD_SEC = 20
const GOAL_CACHE_TTL_MS = 5 * 60 * 1000

let memoryState = null

function todayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isLateNight(d = new Date()) {
  const h = d.getHours()
  return h >= 23 || h < 5
}

function emptyStats() {
  return {
    timeByCategory: {
      social_media: 0,
      video_streaming: 0,
      gaming: 0,
      productivity: 0,
      education: 0,
      news: 0,
      shopping: 0,
      communication: 0,
      other: 0,
    },
    compulsiveCheckCount: 0,
    tabSwitchCount: 0,
    visitCount: 0,
    activeSeconds: 0,
    idleSeconds: 0,
    lateNightSeconds: 0,
    sessionDurations: [],
  }
}

async function loadState() {
  if (memoryState) return memoryState

  const stored = await chrome.storage.local.get([
    'todayDate',
    'todayStats',
    'currentSession',
    'isIdle',
    'windowFocused',
    'cachedGoal',
  ])
  const today = todayKey()

  memoryState = {
    todayDate: stored.todayDate ?? today,
    todayStats: stored.todayStats ?? emptyStats(),
    currentSession: stored.currentSession ?? null,
    isIdle: stored.isIdle ?? false,
    windowFocused: stored.windowFocused ?? true,
    cachedGoal: stored.cachedGoal ?? null,
  }

  if (memoryState.todayDate !== today) {
    await rolloverDay(today)
  }

  return memoryState
}

async function saveState() {
  if (!memoryState) return
  await chrome.storage.local.set({
    todayDate: memoryState.todayDate,
    todayStats: memoryState.todayStats,
    currentSession: memoryState.currentSession,
    isIdle: memoryState.isIdle,
    windowFocused: memoryState.windowFocused,
    cachedGoal: memoryState.cachedGoal,
  })
}

async function rolloverDay(newDate) {
  await flushAggregate()
  memoryState.todayDate = newDate
  memoryState.todayStats = emptyStats()
  memoryState.currentSession = null
}

function extractDomain(url) {
  try {
    const u = new URL(url)
    if (!u.protocol.startsWith('http')) return null
    return u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

async function switchSession(domain, now = Date.now()) {
  const state = await loadState()
  const prev = state.currentSession

  if (prev && prev.domain === domain) return

  if (prev) {
    const durationSec = (now - prev.startedAt) / 1000
    state.todayStats.sessionDurations.push(durationSec)
    if (durationSec < COMPULSIVE_THRESHOLD_SEC) {
      state.todayStats.compulsiveCheckCount += 1
    }
    state.todayStats.tabSwitchCount += 1
  }

  if (domain) {
    state.todayStats.visitCount += 1
    state.currentSession = { domain, category: categorizeDomain(domain), startedAt: now }
  } else {
    state.currentSession = null
  }

  await saveState()
}

async function handleActiveTabChange(tab) {
  if (!tab || !tab.url) return
  await switchSession(extractDomain(tab.url))
}

async function refreshActiveTabState() {
  const state = await loadState()

  let win = null
  try {
    win = await chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] })
  } catch {
    win = null
  }

  const focused = Boolean(win && win.focused)
  state.windowFocused = focused
  await saveState()

  if (!focused || !win) {
    await switchSession(null)
    return
  }

  const activeTab = win.tabs?.find((t) => t.active)
  await handleActiveTabChange(activeTab)
}

chrome.tabs.onActivated.addListener(async (info) => {
  try {
    const tab = await chrome.tabs.get(info.tabId)
    await handleActiveTabChange(tab)
  } catch {
    /* tab may have closed already */
  }
})

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (!tab.active) return
  if (!changeInfo.url && changeInfo.status !== 'complete') return
  await handleActiveTabChange(tab)
})

chrome.windows.onFocusChanged.addListener(async () => {
  await refreshActiveTabState()
})

chrome.idle.setDetectionInterval(60)
chrome.idle.onStateChanged.addListener(async (newState) => {
  const state = await loadState()
  state.isIdle = newState !== 'active'
  await saveState()
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 })
  refreshActiveTabState()
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 })
  refreshActiveTabState()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TICK_ALARM) await tick()
})

async function tick() {
  const state = await loadState()
  const today = todayKey()
  if (state.todayDate !== today) {
    await rolloverDay(today)
  }

  if (state.currentSession && state.windowFocused) {
    if (!state.isIdle) {
      state.todayStats.activeSeconds += 60
      const cat = state.currentSession.category
      state.todayStats.timeByCategory[cat] = (state.todayStats.timeByCategory[cat] || 0) + 60
      if (isLateNight()) state.todayStats.lateNightSeconds += 60
    } else {
      state.todayStats.idleSeconds += 60
    }
  }

  await saveState()
  await flushAggregate()
}

async function getCachedGoal(uid) {
  const state = await loadState()
  const now = Date.now()
  if (state.cachedGoal && now - state.cachedGoal.fetchedAt < GOAL_CACHE_TTL_MS) {
    return state.cachedGoal.goal
  }

  const auth = await getValidAuth()
  if (!auth) return 'study'

  const doc = await firestoreGet(`users/${uid}/dailyGoals/${todayKey()}`, auth.idToken)
  const goal = doc?.goal ?? 'study'
  state.cachedGoal = { goal, fetchedAt: now }
  await saveState()
  return goal
}

function computeGoalAlignment(timeByCategoryMinutes, goal) {
  const productive = timeByCategoryMinutes.productivity + timeByCategoryMinutes.education
  const distraction =
    timeByCategoryMinutes.social_media + timeByCategoryMinutes.video_streaming + timeByCategoryMinutes.gaming
  const total = productive + distraction
  if (total === 0) return 0.5
  if (goal === 'study' || goal === 'work') return productive / total
  if (goal === 'entertainment' || goal === 'relax') return distraction / total
  return 0.5
}

async function flushAggregate() {
  const auth = await getValidAuth()
  if (!auth) return

  const state = await loadState()
  const stats = state.todayStats
  const goal = await getCachedGoal(auth.uid)

  const activeMinutes = stats.activeSeconds / 60
  const totalTrackedSeconds = stats.activeSeconds + stats.idleSeconds
  const avgSessionLengthMin = stats.sessionDurations.length
    ? stats.sessionDurations.reduce((a, b) => a + b, 0) / stats.sessionDurations.length / 60
    : 0

  const timeByCategoryMinutes = Object.fromEntries(
    Object.entries(stats.timeByCategory).map(([k, v]) => [k, Math.round((v / 60) * 10) / 10]),
  )

  const aggregate = {
    timeByCategory: timeByCategoryMinutes,
    compulsiveCheckCount: stats.compulsiveCheckCount,
    tabSwitchFrequency: activeMinutes > 0 ? Math.round((stats.tabSwitchCount / (activeMinutes / 60)) * 10) / 10 : 0,
    lateNightRatio: stats.activeSeconds > 0 ? Math.round((stats.lateNightSeconds / stats.activeSeconds) * 100) / 100 : 0,
    activeIdleRatio:
      totalTrackedSeconds > 0 ? Math.round((stats.activeSeconds / totalTrackedSeconds) * 100) / 100 : 0,
    avgSessionLengthMin: Math.round(avgSessionLengthMin * 10) / 10,
    goalAlignmentScore: Math.round(computeGoalAlignment(timeByCategoryMinutes, goal) * 100) / 100,
    totalActiveMinutes: Math.round(activeMinutes * 10) / 10,
    updatedAt: new Date().toISOString(),
  }

  try {
    await firestoreSet(`users/${auth.uid}/dailyAggregates/${state.todayDate}`, aggregate, auth.idToken)
  } catch (err) {
    console.warn('WellSense: failed to sync aggregate', err)
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'WELLSENSE_SIGN_IN') {
    signIn(msg.email, msg.password)
      .then(async () => {
        memoryState = null
        await refreshActiveTabState()
        await flushAggregate()
        sendResponse({ ok: true })
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === 'WELLSENSE_SIGN_OUT') {
    signOutLocal().then(() => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'WELLSENSE_GET_STATS') {
    loadState().then((state) => {
      sendResponse({
        stats: state.todayStats,
        currentDomain: state.currentSession?.domain ?? null,
      })
    })
    return true
  }

  return false
})
