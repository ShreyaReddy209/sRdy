import type { RiskLevel } from '../../types/dashboard'

const RISK_CONFIG: Record<RiskLevel, { label: string; text: string; badge: string }> = {
  low: { label: 'Low', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  moderate: { label: 'Moderate', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-800 ring-amber-200' },
  high: { label: 'High', text: 'text-orange-700', badge: 'bg-orange-50 text-orange-800 ring-orange-200' },
  critical: { label: 'Critical', text: 'text-red-700', badge: 'bg-red-50 text-red-800 ring-red-200' },
}

interface Props {
  riskLevel: RiskLevel
  riskScore: number
  streakDays: number
}

export default function RiskHero({ riskLevel, riskScore, streakDays }: Props) {
  const cfg = RISK_CONFIG[riskLevel]
  const pct = Math.round(riskScore * 100)

  return (
    <div className="card p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-stone-500">Behavioral risk score</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className={`text-4xl font-semibold tabular-nums ${cfg.text}`}>{pct}%</span>
            <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ring-1 ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <p className="mt-3 max-w-md text-sm text-stone-600">
            Based on your recent usage patterns, check-ins, and stated daily goal.
          </p>
        </div>
        <div className="flex gap-4 border-t border-stone-100 pt-4 sm:border-t-0 sm:pt-0">
          <div>
            <p className="text-2xl font-semibold tabular-nums text-stone-900">{streakDays}</p>
            <p className="text-xs text-stone-500">day check-in streak</p>
          </div>
        </div>
      </div>
    </div>
  )
}
