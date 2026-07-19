import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AuthFooterLink, AuthLink } from '../components/layout/AuthLayout'

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'That email address looks wrong.',
    'auth/weak-password': 'Password should be at least 6 characters.',
  }
  return map[code] ?? 'Could not create account. Try again.'
}

export default function SignupPage() {
  const { signup, authReady } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signup(name, email, password)
      navigate('/onboarding', { replace: true })
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
          {' '}before creating an account.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Create account</h1>
      <p className="mt-1 text-sm text-stone-500">Takes less than a minute.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="label">Name</label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            className="input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={6}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-stone-400">At least 6 characters</p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button type="submit" disabled={submitting} className="btn-accent w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <AuthFooterLink>
        Already registered? <AuthLink to="/login">Sign in</AuthLink>
      </AuthFooterLink>
    </div>
  )
}
