import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useUserProfile } from './context/UserProfileContext'
import DashboardPage from './pages/DashboardPage'
import InsightsPage from './pages/InsightsPage'
import CoachPage from './pages/CoachPage'
import FocusPage from './pages/FocusPage'
import CheckInPage from './pages/CheckInPage'
import UsagePage from './pages/UsagePage'
import OnboardingPage from './pages/OnboardingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import FirebaseSetupPage from './pages/FirebaseSetupPage'
import Layout from './components/layout/Layout'
import AuthLayout from './components/layout/AuthLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RequireOnboarding, { OnboardingOnly } from './components/auth/OnboardingGate'

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading } = useUserProfile()

  if (authLoading || (user && profileLoading)) return null

  if (user) {
    const onboarded = profile?.onboardingComplete ?? false
    return <Navigate to={onboarded ? '/' : '/onboarding'} replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<FirebaseSetupPage />} />

      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestOnly>
              <SignupPage />
            </GuestOnly>
          }
        />
      </Route>

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingOnly>
              <OnboardingPage />
            </OnboardingOnly>
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <RequireOnboarding>
              <Layout />
            </RequireOnboarding>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/coach" element={<CoachPage />} />
        <Route path="/focus" element={<FocusPage />} />
        <Route path="/checkin" element={<CheckInPage />} />
        <Route path="/usage" element={<UsagePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
