import { getStoredAuth } from './firestoreRest.js'

const $ = (id) => document.getElementById(id)

let lastPayload = null
let countdownTimer = null

function formatMinutes(sec) {
  const mins = Math.floor(sec / 60)
  const rem = Math.round(sec % 60)
  if (mins <= 0) return `${rem}s`
  if (rem === 0) return `${mins} min`
  return `${mins}m ${rem}s`
}

function formatCategory(cat) {
  if (!cat) return '—'
  return cat.replace(/_/g, ' ')
}

function applyCountdown() {
  if (!lastPayload) return
  const secondsLeft = Math.max(0, Math.ceil((lastPayload.nextTickAt - Date.now()) / 1000))
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  $('sync-countdown').textContent = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

function applyPayload(payload) {
  if (!payload) return
  lastPayload = payload
  const { stats, currentDomain, currentCategory, isPaused, isIdle, windowFocused } = payload

  $('active-time').textContent = formatMinutes(stats.activeSeconds)
  $('current-domain').textContent = currentDomain ?? 'No site yet'
  $('current-category').textContent = formatCategory(currentCategory)
  $('compulsive-count').textContent = stats.compulsiveCheckCount
  $('tab-switches').textContent = stats.tabSwitchCount

  const top = Object.entries(stats.timeByCategory).sort((a, b) => b[1] - a[1])[0]
  $('top-category').textContent = top && top[1] > 0 ? formatCategory(top[0]) : '—'

  const statusEl = $('tracking-status')
  statusEl.classList.remove('status-active', 'status-paused', 'status-idle')
  if (!windowFocused) {
    statusEl.textContent = 'Paused — Chrome not focused'
    statusEl.classList.add('status-paused')
  } else if (isIdle) {
    statusEl.textContent = 'Idle — no input recently'
    statusEl.classList.add('status-idle')
  } else if (currentDomain) {
    statusEl.textContent = 'Tracking'
    statusEl.classList.add('status-active')
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
  if (!confirm('Clear today’s tracked minutes/categories and start fresh? (Keeps you signed in.)')) return
  chrome.runtime.sendMessage({ type: 'WELLSENSE_RESET_TODAY' }, (res) => {
    if (res?.ok) applyPayload(res)
  })
})

render()
setInterval(render, 4000)
countdownTimer = setInterval(applyCountdown, 1000)
