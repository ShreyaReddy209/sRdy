import { Navigate } from 'react-router-dom'
import { useUserProfile } from '../../context/UserProfileContext'

/** Redirect to onboarding if user hasn't finished setup */
export default function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useUserProfile()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-stone-500">Loading your profile…</p>
      </div>
    )
  }

  if (!profile?.onboardingComplete) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

/** Redirect away from onboarding if already done */
export function OnboardingOnly({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useUserProfile()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-sm text-stone-500">Loading…</p>
      </div>
    )
  }

  if (profile?.onboardingComplete) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
