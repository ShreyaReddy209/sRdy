import type { DailyGoal } from '../../types/dashboard'

const GOALS: { id: DailyGoal; label: string }[] = [
  { id: 'study', label: 'Study' },
  { id: 'work', label: 'Work' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'relax', label: 'Relax' },
]

interface Props {
  selected: DailyGoal
  loading?: boolean
  onSelect?: (goal: DailyGoal) => void
}

export default function DailyGoalSelector({ selected, loading, onSelect }: Props) {
  return (
    <div className="card p-5">
      <h2 className="section-heading">Today&apos;s goal</h2>
      <p className="section-desc">Changes how usage is scored</p>
      {loading ? (
        <p className="mt-3 text-sm text-stone-400">Loading…</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
        {GOALS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect?.(g.id)}
            className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
              selected === g.id
                ? 'border-teal-600 bg-teal-50 text-teal-900'
                : 'border-stone-200 text-stone-600 hover:border-stone-300'
            }`}
          >
            {g.label}
          </button>
        ))}
        </div>
      )}
    </div>
  )
}
