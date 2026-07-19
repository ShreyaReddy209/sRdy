// Talks to Firebase Auth + Firestore over plain REST so the extension needs
// no bundler and no Firebase SDK (which has MV3 service-worker compatibility issues).
import { FIREBASE_CONFIG } from './config.js'

const AUTH_KEY = 'authState'

export async function getStoredAuth() {
  const { [AUTH_KEY]: auth } = await chrome.storage.local.get(AUTH_KEY)
  return auth ?? null
}

async function setStoredAuth(auth) {
  await chrome.storage.local.set({ [AUTH_KEY]: auth })
}

export async function signOutLocal() {
  await chrome.storage.local.remove(AUTH_KEY)
}

export async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Sign in failed')

  const auth = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    uid: data.localId,
    email: data.email,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  }
  await setStoredAuth(auth)
  return auth
}

async function refreshIdToken(refreshToken) {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Token refresh failed')

  const prev = await getStoredAuth()
  const auth = {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    uid: data.user_id,
    email: prev?.email ?? '',
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  }
  await setStoredAuth(auth)
  return auth
}

export async function getValidAuth() {
  const auth = await getStoredAuth()
  if (!auth) return null
  if (Date.now() < auth.expiresAt - 60_000) return auth
  try {
    return await refreshIdToken(auth.refreshToken)
  } catch {
    await signOutLocal()
    return null
  }
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } }
  return { mapValue: { fields: toFirestoreFields(v) } }
}

function toFirestoreFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)]))
}

function fromFirestoreValue(v) {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return parseInt(v.integerValue, 10)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromFirestoreValue)
  if ('mapValue' in v) return fromFirestoreFields(v.mapValue.fields ?? {})
  return null
}

function fromFirestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, fromFirestoreValue(v)]))
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`

export async function firestoreGet(path, idToken) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (res.status === 404) return null
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Firestore read failed')
  return fromFirestoreFields(data.fields)
}

/** Full overwrite (matches setDoc without merge) — simplest for periodic aggregate flushes */
export async function firestoreSet(path, obj, idToken) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreFields(obj) }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error?.message ?? 'Firestore write failed')
  }
  return res.json()
}
