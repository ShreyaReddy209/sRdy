import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUserProfile } from '../context/UserProfileContext'
import { completeOnboarding, setDailyGoal } from '../services/userData'
import type { DailyGoal } from '../types/dashboard'

const STEPS = ['Welcome', 'Daily goal', 'Extension', 'Check-in']

const GOALS: { id: DailyGoal; label: string }[] = [
  { id: 'study', label: 'Study' },
  { id: 'work', label: 'Work' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'relax', label: 'Relax' },
]

export default function OnboardingPage() {
  const { user } = useAuth()
  const { refresh } = useUserProfile()
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<DailyGoal>('study')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function finish() {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await setDailyGoal(user.uid, goal)
      await completeOnboarding(user.uid)
      await refresh()
      navigate('/', { replace: true })
    } catch {
      setError('Could not save. Check Firestore rules and try again.')
    } finally {
      setSaving(false)
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else finish()
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <div className="mb-8 flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={STEPS[i]}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-teal-600' : 'bg-stone-200'}`}
            />
          ))}
        </div>

        <div className="card p-6 sm:p-8">
          {step === 0 && (
            <>
              <h1 className="text-xl font-semibold text-stone-900">Welcome</h1>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                WellSense tracks how you use the web, estimates behavioral risk with an LSTM model,
                and sends nudges before unproductive patterns set in.
              </p>
              <p className="mt-4 text-sm text-stone-500">
                We only log domains and time — not what you read or type.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-xl font-semibold text-stone-900">Today&apos;s goal</h1>
              <p className="mt-2 text-sm text-stone-600">
                The same website counts differently depending on what you planned to do.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                      goal === g.id
                        ? 'border-teal-600 bg-teal-50 text-teal-900'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-xl font-semibold text-stone-900">Browser extension</h1>
              <p className="mt-2 text-sm text-stone-600">
                Install the WellSense Tracker extension so your dashboard sees real usage instead of estimates.
              </p>
              <ol className="mt-5 space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                <li>1. Open <code className="rounded bg-stone-200 px-1 text-xs">chrome://extensions</code></li>
                <li>2. Turn on <strong>Developer mode</strong> (top right)</li>
                <li>3. Click <strong>Load unpacked</strong> and select the project&apos;s <code className="rounded bg-stone-200 px-1 text-xs">extension</code> folder</li>
                <li>4. Open the extension icon and sign in with this same account</li>
              </ol>
              <p className="mt-3 text-xs text-stone-400">
                You can skip this for now, but your dashboard won&apos;t have a real prediction until you either
                install the extension or complete a check-in.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-xl font-semibold text-stone-900">Daily check-in</h1>
              <p className="mt-2 text-sm text-stone-600">
                Each day you&apos;ll tap your mood, stress, and sleep on the dashboard.
                No typing — takes about 10 seconds.
              </p>
            </>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="mt-8 flex justify-between">
            {step > 0 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-ghost" disabled={saving}>
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={next} className="btn-accent" disabled={saving}>
              {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Open dashboard' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
