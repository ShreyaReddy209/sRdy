import { getStoredAuth } from './firestoreRest.js'
import { categorizeDomain } from './categoryMap.js'

const $ = (id) => document.getElementById(id)

let lastPayload = null

function formatMinutes(sec) {
  const mins = Math.floor(sec / 60)
  const rem = Math.round(sec % 60)
  if (mins <= 0) return `${rem}s`
  if (rem === 0) return `${mins} min`
  return `${mins}m ${rem}s`
}

function formatCategory(cat) {
  if (cat == null || cat === '' || cat === 'null' || cat === 'undefined' || cat === '—') return '—'
  return String(cat).replace(/_/g, ' ')
}

/** Always derive category from the domain in the popup so Category never stays blank. */
function resolveCategory(payload) {
  const domain = payload?.currentDomain
  if (!domain) return null
  const fromBg = payload.currentCategory
  if (fromBg && fromBg !== '—' && fromBg !== 'null') return fromBg
  return categorizeDomain(domain)
}

function applyCountdown() {
  const el = $('sync-countdown')
  if (!el) return
  if (!lastPayload) {
    el.textContent = '—'
    return
  }
  const next = Number(lastPayload.nextTickAt)
  if (!Number.isFinite(next)) {
    el.textContent = '—'
    return
  }
  const secondsLeft = Math.max(0, Math.ceil((next - Date.now()) / 1000))
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  el.textContent = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

function applyPayload(payload) {
  if (!payload?.stats) return
  lastPayload = {
    ...payload,
    nextTickAt: Number(payload.nextTickAt) || Date.now() + 60_000,
  }

  const domain = payload.currentDomain ?? null
  const category = resolveCategory(payload)

  $('active-time').textContent = formatMinutes(payload.stats.activeSeconds ?? 0)
  $('current-domain').textContent = domain ?? 'No site yet'
  $('current-category').textContent = formatCategory(category)
  $('compulsive-count').textContent = payload.stats.compulsiveCheckCount ?? 0
  $('tab-switches').textContent = payload.stats.tabSwitchCount ?? 0

  const top = Object.entries(payload.stats.timeByCategory || {}).sort((a, b) => b[1] - a[1])[0]
  $('top-category').textContent = top && top[1] > 0 ? formatCategory(top[0]) : '—'

  const statusEl = $('tracking-status')
  statusEl.classList.remove('status-active', 'status-paused', 'status-idle')
  // Opening the popup often marks the window "unfocused" — don't show Paused if we still know the site
  if (payload.isIdle) {
    statusEl.textContent = 'Idle — no input recently'
    statusEl.classList.add('status-idle')
  } else if (domain) {
    statusEl.textContent = 'Tracking'
    statusEl.classList.add('status-active')
  } else if (!payload.windowFocused) {
    statusEl.textContent = 'Paused — Chrome not focused'
    statusEl.classList.add('status-paused')
  } else {
    statusEl.textContent = 'Waiting for a website'
    statusEl.classList.add('status-paused')
  }

  applyCountdown()
}

async function render() {
  const auth = await getStoredAuth()

  if (!auth) {
    $('signed-out').classList.remove('hidden')
    $('signed-in').classList.add('hidden')
    return
  }

  $('signed-out').classList.add('hidden')
  $('signed-in').classList.remove('hidden')
  $('user-email').textContent = auth.email

  chrome.runtime.sendMessage({ type: 'WELLSENSE_GET_STATS' }, (res) => {
    if (chrome.runtime.lastError || !res) return
    applyPayload(res)
  })
}

$('login-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const email = $('email').value.trim()
  const password = $('password').value
  $('login-error').textContent = ''
  $('login-btn').disabled = true
  $('login-btn').textContent = 'Signing in…'

  chrome.runtime.sendMessage({ type: 'WELLSENSE_SIGN_IN', email, password }, (res) => {
    $('login-btn').disabled = false
    $('login-btn').textContent = 'Sign in'
    if (!res?.ok) {
      $('login-error').textContent = res?.error ?? 'Sign in failed'
      return
    }
    render()
  })
})

$('signout-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'WELLSENSE_SIGN_OUT' }, () => render())
})

$('sync-now-btn').addEventListener('click', () => {
  $('sync-now-btn').disabled = true
  $('sync-now-btn').textContent = 'Syncing…'
  chrome.runtime.sendMessage({ type: 'WELLSENSE_FORCE_SYNC' }, (res) => {
    $('sync-now-btn').disabled = false
    $('sync-now-btn').textContent = 'Sync now'
    if (res?.ok) applyPayload(res)
  })
})

$('reset-today-btn').addEventListener('click', () => {
  if (
    !confirm(
      "Clear ALL of today's tracking? This permanently removes today's history and is not needed for site lists — new browsing adds domains on top of past totals.",
    )
  ) {
    return
  }
  chrome.runtime.sendMessage({ type: 'WELLSENSE_RESET_TODAY' }, (res) => {
    if (res?.ok) applyPayload(res)
  })
})

render()
setInterval(render, 4000)
setInterval(applyCountdown, 1000)
