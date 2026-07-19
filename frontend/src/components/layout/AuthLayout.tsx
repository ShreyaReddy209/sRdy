import { Link, Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[42%] flex-col justify-between bg-teal-800 p-10 text-white lg:flex">
        <div>
          <p className="text-lg font-semibold">WellSense</p>
          <p className="mt-1 text-sm text-teal-200">Digital Wellness & Behavioral Intelligence</p>
        </div>
        <div>
          <p className="max-w-sm text-2xl font-medium leading-snug">
            Track habits, predict risk, and get nudges before patterns slip.
          </p>
          <p className="mt-4 text-sm text-teal-200/90">
            Mini project · AI/ML · LSTM-based behavioral forecasting
          </p>
        </div>
        <p className="text-xs text-teal-300">Domains tracked only — never page content.</p>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mb-8 lg:hidden">
          <p className="font-semibold text-stone-900">WellSense</p>
          <p className="text-sm text-stone-500">Sign in to your account</p>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <Outlet />
        </div>
        <p className="mx-auto mt-10 max-w-sm text-center text-xs text-stone-400">
          By continuing you agree to our data policy. Usage data stays tied to your account.
        </p>
      </div>
    </div>
  )
}

export function AuthFooterLink({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-center text-sm text-stone-600">{children}</p>
}

export function AuthLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="font-medium text-teal-700 hover:text-teal-800">
      {children}
    </Link>
  )
}
