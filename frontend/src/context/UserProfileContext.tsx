import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { getUserProfile, createUserProfile, type UserProfile } from '../services/userData'

interface UserProfileContextValue {
  profile: UserProfile | null
  loading: boolean
  refresh: () => Promise<void>
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null)

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      let p = await getUserProfile(user.uid)
      if (!p && user.email) {
        await createUserProfile(user.uid, user.email, user.displayName ?? user.email.split('@')[0])
        p = await getUserProfile(user.uid)
      }
      setProfile(p)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <UserProfileContext.Provider value={{ profile, loading, refresh }}>
      {children}
    </UserProfileContext.Provider>
  )
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext)
  if (!ctx) throw new Error('useUserProfile must be used inside UserProfileProvider')
  return ctx
}
