import { getStoredAuth } from './firestoreRest.js'

const $ = (id) => document.getElementById(id)

function formatMinutes(sec) {
  return `${Math.round(sec / 60)} min`
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
    if (!res) return
    const { stats, currentDomain } = res
    $('active-time').textContent = formatMinutes(stats.activeSeconds)
    $('current-domain').textContent = currentDomain ?? 'No active site'
    $('compulsive-count').textContent = stats.compulsiveCheckCount
    $('tab-switches').textContent = stats.tabSwitchCount

    const top = Object.entries(stats.timeByCategory).sort((a, b) => b[1] - a[1])[0]
    $('top-category').textContent = top && top[1] > 0 ? top[0].replace('_', ' ') : '—'
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

render()
setInterval(render, 5000)
