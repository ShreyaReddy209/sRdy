import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, isAuthReady, isFirebaseConfigured } from '../lib/firebase'
import { createUserProfile } from '../services/userData'

export interface AppUser {
  uid: string
  email: string | null
  displayName: string | null
}

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  authReady: boolean
  login: (email: string, password: string) => Promise<AppUser>
  signup: (name: string, email: string, password: string) => Promise<AppUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAppUser(fbUser: { uid: string; email: string | null; displayName: string | null }): AppUser {
  return { uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? toAppUser(u) : null)
      setLoading(false)
    })
  }, [])

  async function login(email: string, password: string): Promise<AppUser> {
    if (!auth) throw new Error('Firebase is not configured')
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const appUser = toAppUser(cred.user)
    setUser(appUser)
    return appUser
  }

  async function signup(name: string, email: string, password: string): Promise<AppUser> {
    if (!auth) throw new Error('Firebase is not configured')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const displayName = name.trim() || email.split('@')[0]
    if (name.trim()) await updateProfile(cred.user, { displayName })
    await createUserProfile(cred.user.uid, email, displayName)
    const appUser = toAppUser(cred.user)
    setUser(appUser)
    return appUser
  }

  async function logout() {
    if (!auth) return
    await signOut(auth)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authReady: isAuthReady,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
