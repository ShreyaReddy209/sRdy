import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../services/userData'
import { AuthFooterLink, AuthLink } from '../components/layout/AuthLayout'

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address looks wrong.',
    'auth/user-not-found': 'No account with that email. Sign up first.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  }
  return map[code] ?? 'Could not sign in. Check your details.'
}

export default function LoginPage() {
  const { login, authReady } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const appUser = await login(email, password)
      const profile = await getUserProfile(appUser.uid)
      navigate(profile?.onboardingComplete ? from : '/onboarding', { replace: true })
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setError(friendlyError(code))
    } finally {
      setSubmitting(false)
    }
  }

  if (!authReady) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Setup required</h1>
        <p className="mt-2 text-sm text-stone-600">
          <Link to="/setup" className="text-teal-700 underline">Follow the Firebase setup guide</Link>
          {' '}before signing in.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Sign in</h1>
      <p className="mt-1 text-sm text-stone-500">Use the email you registered with.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button type="submit" disabled={submitting} className="btn-accent w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <AuthFooterLink>
        No account yet? <AuthLink to="/signup">Create one</AuthLink>
      </AuthFooterLink>
    </div>
  )
}
