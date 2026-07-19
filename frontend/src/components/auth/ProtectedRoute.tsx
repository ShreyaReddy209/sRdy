import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import FirebaseSetupPage from '../../pages/FirebaseSetupPage'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, authReady } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-sm text-stone-500">Loading…</p>
      </div>
    )
  }

  if (!authReady) {
    return <FirebaseSetupPage />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
