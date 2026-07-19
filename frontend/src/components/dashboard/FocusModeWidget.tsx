import type { DailyAggregate } from '../../types/dashboard'

interface Props {
  aggregate: DailyAggregate | null
}

const CLASS_LABELS = {
  productive: { label: 'Productive', className: 'bg-emerald-50 text-emerald-800' },
  compulsive: { label: 'Compulsive', className: 'bg-orange-50 text-orange-800' },
  mixed: { label: 'Mixed', className: 'bg-amber-50 text-amber-800' },
} as const

function classify(agg: DailyAggregate): keyof typeof CLASS_LABELS {
  const compulsiveRate = agg.totalActiveMinutes > 0 ? agg.compulsiveCheckCount / agg.totalActiveMinutes : 0
  if (compulsiveRate > 0.5) return 'compulsive'
  if (agg.goalAlignmentScore >= 0.6) return 'productive'
  return 'mixed'
}

function topCategory(agg: DailyAggregate): string | null {
  const entries = Object.entries(agg.timeByCategory).filter(([, minutes]) => minutes > 0)
  if (!entries.length) return null
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0].replace(/_/g, ' ')
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function FocusModeWidget({ aggregate }: Props) {
  if (!aggregate) {
    return (
      <div className="card p-5">
        <h2 className="section-heading">Today&apos;s focus</h2>
        <p className="section-desc">No live data yet</p>
        <p className="mt-4 text-sm text-stone-500">
          Install and sign into the WellSense browser extension to see today&apos;s activity classified here in
          real time.
        </p>
      </div>
    )
  }

  const cls = CLASS_LABELS[classify(aggregate)]
  const top = topCategory(aggregate)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-heading">Today&apos;s focus</h2>
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cls.className}`}>{cls.label}</span>
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-stone-900">
        {formatDuration(aggregate.totalActiveMinutes)}
      </p>
      <p className="mt-1 truncate text-sm text-stone-500">
        {top ? `Mostly ${top}` : 'No tracked activity yet today'}
      </p>
      <p className="mt-4 text-xs text-stone-400">From your browser extension · updates automatically</p>
    </div>
  )
}
