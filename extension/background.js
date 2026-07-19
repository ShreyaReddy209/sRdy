import { categorizeDomain } from './categoryMap.js'
import { firestoreGet, firestoreSet, getValidAuth, signIn, signOutLocal } from './firestoreRest.js'

const TICK_ALARM = 'wellsense-tick'
/** Sessions shorter than this (seconds) after a real domain change count as a compulsive check. */
const COMPULSIVE_THRESHOLD_SEC = 8
/** Ignore "switches" that happen within this many ms of the previous one (focus flicker). */
const SWITCH_DEBOUNCE_MS = 400
const GOAL_CACHE_TTL_MS = 5 * 60 * 1000
/** Chrome alarms are ~1 min; we accrue wall-clock delta, capped so a long sleep doesn't dump hours. */
const MAX_ACCRUAL_SEC = 90
const TICK_PERIOD_MS = 60_000

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
    /** domain -> { seconds, category } — powers click-to-expand site lists on the dashboard */
    timeByDomain: {},
    compulsiveCheckCount: 0,
    tabSwitchCount: 0,
    visitCount: 0,
    activeSeconds: 0,
    idleSeconds: 0,
    lateNightSeconds: 0,
    sessionDurations: [],
  }
}

/** Older local storage may lack timeByDomain — normalize on load. */
function normalizeStats(stats) {
  if (!stats.timeByDomain || typeof stats.timeByDomain !== 'object') {
    stats.timeByDomain = {}
  }
  return stats
}

async function ensureAlarm() {
  const existing = await chrome.alarms.get(TICK_ALARM)
  if (!existing) {
    await chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 })
  }
}

async function loadState() {
  if (memoryState) {
    memoryState.todayStats = normalizeStats(memoryState.todayStats)
    return memoryState
  }

  const stored = await chrome.storage.local.get([
    'todayDate',
    'todayStats',
    'currentSession',
    'isIdle',
    'windowFocused',
    'cachedGoal',
    'lastTickAt',
    'lastSwitchAt',
  ])
  const today = todayKey()

  memoryState = {
    todayDate: stored.todayDate ?? today,
    todayStats: normalizeStats(stored.todayStats ?? emptyStats()),
    currentSession: stored.currentSession ?? null,
    isIdle: stored.isIdle ?? false,
    windowFocused: stored.windowFocused ?? true,
    cachedGoal: stored.cachedGoal ?? null,
    lastTickAt: stored.lastTickAt ?? Date.now(),
    lastSwitchAt: stored.lastSwitchAt ?? 0,
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
    lastTickAt: memoryState.lastTickAt,
    lastSwitchAt: memoryState.lastSwitchAt,
  })
}

async function rolloverDay(newDate) {
  await flushAggregate()
  memoryState.todayDate = newDate
  memoryState.todayStats = emptyStats()
  memoryState.currentSession = null
  memoryState.lastTickAt = Date.now()
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

/**
 * Change the tracked domain. Only counts tab switches / compulsive checks when
 * the user actually moves between two different http domains — NOT on window blur.
 */
/** Always resolve category from the live domain map (never trust a stale session.category). */
function categoryFor(domain) {
  return categorizeDomain(domain)
}

async function switchSession(domain, now = Date.now(), { countSwitch = true } = {}) {
  const state = await loadState()
  const prev = state.currentSession

  // Same domain: still refresh category in case the map was updated after Load/Reload
  if (prev && prev.domain === domain) {
    const cat = categoryFor(domain)
    if (prev.category !== cat) {
      state.currentSession = { ...prev, category: cat }
      await saveState()
    }
    return
  }

  // Debounce rapid flicker (focus thrash / SPA redirects)
  if (countSwitch && now - state.lastSwitchAt < SWITCH_DEBOUNCE_MS) {
    if (domain) {
      state.currentSession = { domain, category: categoryFor(domain), startedAt: now }
      await saveState()
    }
    return
  }

  if (prev && countSwitch) {
    const durationSec = (now - prev.startedAt) / 1000
    // Only record meaningful sessions (ignore sub-second glitches)
    if (durationSec >= 0.5) {
      state.todayStats.sessionDurations.push(durationSec)
      state.todayStats.tabSwitchCount += 1
      if (durationSec < COMPULSIVE_THRESHOLD_SEC) {
        state.todayStats.compulsiveCheckCount += 1
      }
    }
    state.lastSwitchAt = now
  }

  if (domain) {
    if (!prev || prev.domain !== domain) {
      state.todayStats.visitCount += 1
    }
    state.currentSession = { domain, category: categoryFor(domain), startedAt: now }
  } else {
    // Keep last domain for display; caller sets windowFocused=false to pause accrual
    // Do not wipe currentSession here.
  }

  await saveState()
}

async function handleActiveTabChange(tab) {
  if (!tab?.url) return
  const domain = extractDomain(tab.url)
  if (!domain) return
  const state = await loadState()
  state.windowFocused = true
  await saveState()
  await switchSession(domain, Date.now(), { countSwitch: true })
}

/**
 * Sync focus + active tab. On blur we PAUSE time accrual but keep showing the last site.
 * Previously this called switchSession(null), which wiped "Current site" and inflated switches.
 */
async function refreshActiveTabState() {
  const state = await loadState()

  let win = null
  try {
    win = await chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] })
  } catch {
    win = null
  }

  const focused = Boolean(win?.focused)
  state.windowFocused = focused
  await saveState()

  if (!focused || !win) {
    // Pause only — do not clear currentSession or count a tab switch
    return
  }

  const activeTab = win.tabs?.find((t) => t.active)
  if (activeTab?.url) {
    const domain = extractDomain(activeTab.url)
    if (domain) {
      // Same domain after refocus: resume (switchSession refreshes category if map changed)
      await switchSession(domain, Date.now(), { countSwitch: state.currentSession?.domain !== domain })
    }
  }
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

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    const state = await loadState()
    state.windowFocused = false
    await saveState()
    return
  }
  await refreshActiveTabState()
})

chrome.idle.setDetectionInterval(60)
chrome.idle.onStateChanged.addListener(async (newState) => {
  const state = await loadState()
  state.isIdle = newState !== 'active'
  await saveState()
})

chrome.runtime.onInstalled.addListener(async () => {
  await ensureAlarm()
  await refreshActiveTabState()
})

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarm()
  await refreshActiveTabState()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TICK_ALARM) await tick()
})

/**
 * Accrue real wall-clock seconds since last tick (not a blind +60).
 * Re-reads the active tab first so we don't credit the wrong site.
 */
async function tick() {
  await ensureAlarm()
  const state = await loadState()
  const today = todayKey()
  if (state.todayDate !== today) {
    await rolloverDay(today)
  }

  const now = Date.now()
  const elapsedSec = Math.min(Math.max((now - state.lastTickAt) / 1000, 0), MAX_ACCRUAL_SEC)
  state.lastTickAt = now

  // Refresh focus/tab before accruing so pause/resume is accurate
  await refreshActiveTabState()
  const fresh = await loadState()

  if (elapsedSec > 0.5 && fresh.currentSession && fresh.windowFocused) {
    if (!fresh.isIdle) {
      // Re-categorize every tick so an outdated "other" session cannot keep poisoning totals
      const domain = fresh.currentSession.domain
      const cat = categoryFor(domain)
      fresh.currentSession.category = cat
      fresh.todayStats.activeSeconds += elapsedSec
      fresh.todayStats.timeByCategory[cat] = (fresh.todayStats.timeByCategory[cat] || 0) + elapsedSec
      if (!fresh.todayStats.timeByDomain) fresh.todayStats.timeByDomain = {}
      const domainEntry = fresh.todayStats.timeByDomain[domain] ?? { seconds: 0, category: cat }
      domainEntry.seconds += elapsedSec
      domainEntry.category = cat
      fresh.todayStats.timeByDomain[domain] = domainEntry
      if (isLateNight()) fresh.todayStats.lateNightSeconds += elapsedSec
    } else {
      fresh.todayStats.idleSeconds += elapsedSec
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

  // Per-site breakdown (sorted by minutes desc) for dashboard drill-down
  const sites = Object.entries(stats.timeByDomain || {})
    .map(([domain, entry]) => ({
      domain,
      category: entry.category || categoryFor(domain),
      minutes: Math.round((entry.seconds / 60) * 10) / 10,
    }))
    .filter((s) => s.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)

  // Switches per hour of active browsing — stable even with low early minutes
  const hoursActive = Math.max(activeMinutes / 60, 1 / 60)
  const tabSwitchFrequency = Math.round((stats.tabSwitchCount / hoursActive) * 10) / 10

  const aggregate = {
    timeByCategory: timeByCategoryMinutes,
    sites,
    compulsiveCheckCount: stats.compulsiveCheckCount,
    tabSwitchFrequency,
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

/** Resolve the tab the user is actually on (works even while the extension popup is open). */
async function resolveActiveDomain() {
  const queries = [
    { active: true, lastFocusedWindow: true },
    { active: true, currentWindow: true },
  ]
  for (const q of queries) {
    try {
      const tabs = await chrome.tabs.query(q)
      const domain = extractDomain(tabs[0]?.url ?? '')
      if (domain) return domain
    } catch {
      /* try next query */
    }
  }
  return null
}

async function buildStatsPayload(state) {
  const lastTick = Number(state.lastTickAt)
  const safeLastTick = Number.isFinite(lastTick) && lastTick > 0 ? lastTick : Date.now()
  const nextTickAt = safeLastTick + TICK_PERIOD_MS
  const secondsToSync = Math.max(0, Math.ceil((nextTickAt - Date.now()) / 1000))

  // Prefer live active tab — currentSession can be stale right after the service worker wakes
  // or while the popup is open and focus events get weird.
  let liveDomain = null
  try {
    liveDomain = await resolveActiveDomain()
  } catch {
    liveDomain = null
  }
  const domain = liveDomain ?? state.currentSession?.domain ?? null
  let currentCategory = null
  try {
    currentCategory = domain ? categoryFor(domain) : null
  } catch {
    currentCategory = domain ? 'other' : null
  }

  if (domain) {
    if (!state.currentSession || state.currentSession.domain !== domain) {
      state.currentSession = {
        domain,
        category: currentCategory,
        startedAt: state.currentSession?.startedAt ?? Date.now(),
      }
    } else {
      state.currentSession.category = currentCategory
    }
    // If we can see an http(s) tab, treat the browser as focused for accrual/display
    // (extension popup often flips windowFocused to false incorrectly).
    if (liveDomain) state.windowFocused = true
    try {
      await saveState()
    } catch {
      /* non-fatal for popup display */
    }
  }

  return {
    stats: state.todayStats,
    currentDomain: domain,
    currentCategory: currentCategory || null,
    isPaused: state.isIdle || (!state.windowFocused && !domain),
    isIdle: Boolean(state.isIdle),
    windowFocused: Boolean(state.windowFocused || liveDomain),
    lastTickAt: safeLastTick,
    nextTickAt,
    secondsToSync,
  }
}

/** Wipe today's totals so a day poisoned by stale "other" can start clean. */
async function resetTodayStats() {
  const state = await loadState()
  const domain = state.currentSession?.domain ?? null
  state.todayStats = emptyStats()
  state.lastTickAt = Date.now()
  if (domain) {
    state.currentSession = {
      domain,
      category: categoryFor(domain),
      startedAt: Date.now(),
    }
  }
  await saveState()
  await flushAggregate()
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'WELLSENSE_SIGN_IN') {
    signIn(msg.email, msg.password)
      .then(async () => {
        memoryState = null
        await ensureAlarm()
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
    ensureAlarm()
      .then(() => loadState())
      .then((state) => buildStatsPayload(state))
      .then((payload) => sendResponse(payload))
      .catch((err) => {
        console.warn('WellSense GET_STATS failed', err)
        sendResponse(null)
      })
    return true
  }

  if (msg.type === 'WELLSENSE_FORCE_SYNC') {
    tick()
      .then(() => loadState())
      .then((state) => buildStatsPayload(state))
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (msg.type === 'WELLSENSE_RESET_TODAY') {
    resetTodayStats()
      .then(async () => {
        const state = await loadState()
        return buildStatsPayload(state)
      })
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  return false
})

// Service worker may wake without onInstalled — keep alarm alive
ensureAlarm()
refreshActiveTabState()
