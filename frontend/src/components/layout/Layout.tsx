import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
  ClipboardCheck,
  LayoutDashboard,
  Lightbulb,
  Menu,
  MessageCircle,
  PieChart,
  Timer,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { DashboardDataProvider } from '../../context/DashboardDataContext'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/coach', label: 'Coach', icon: MessageCircle },
  { to: '/focus', label: 'Focus Mode', icon: Timer },
  { to: '/checkin', label: 'Daily Check-in', icon: ClipboardCheck },
  { to: '/usage', label: 'Usage', icon: PieChart },
]

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-teal-50 text-teal-800' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
  }`
}

export default function Layout() {
  const { user, logout } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const initial = user?.displayName?.[0] ?? user?.email?.[0] ?? '?'

  return (
    <DashboardDataProvider>
      <div className="flex min-h-screen bg-[#f7f7f5]">
        {navOpen && (
          <div
            className="fixed inset-0 z-40 bg-stone-900/30 sm:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-stone-200 bg-white transition-transform duration-200 sm:static sm:z-auto sm:w-60 sm:translate-x-0 sm:transition-none ${
            navOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-5 py-5">
            <div>
              <p className="text-sm font-semibold text-stone-900">WellSense</p>
              <p className="text-xs text-stone-500">Behavioral wellness</p>
            </div>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              className="text-stone-400 hover:text-stone-600 sm:hidden"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end className={navLinkClass} onClick={() => setNavOpen(false)}>
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-stone-200 bg-white">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                className="text-stone-500 hover:text-stone-800 sm:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <p className="text-sm font-semibold text-stone-900 sm:hidden">WellSense</p>
              <div className="ml-auto flex items-center gap-3">
                <span className="hidden text-sm text-stone-600 sm:inline">
                  {user?.displayName ?? user?.email}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-xs font-medium text-white uppercase">
                  {initial}
                </div>
                <button type="button" onClick={() => logout()} className="btn-ghost text-xs">
                  Sign out
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </DashboardDataProvider>
  )
}
