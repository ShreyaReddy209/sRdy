import type { Contributor } from '../../types/dashboard'

interface Props {
  explanation: string
  contributors: Contributor[]
}

export default function ExplanationPanel({ explanation, contributors }: Props) {
  return (
    <div className="card p-5">
      <h2 className="section-heading">Why this score?</h2>
      <p className="section-desc">Model explanation from top feature contributions</p>
      <p className="mt-4 text-sm leading-relaxed text-stone-700">{explanation}</p>
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
          Top factors
        </p>
        <ul className="space-y-2">
          {contributors.map((c, i) => (
            <li
              key={c.feature}
              className="flex items-center justify-between gap-4 rounded-lg bg-stone-50 px-3 py-2 text-sm"
            >
              <span className="text-stone-700">
                <span className="mr-2 text-stone-400">{i + 1}.</span>
                {c.label}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className={`h-full rounded-full ${
                      c.direction === 'up' ? 'bg-orange-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${c.impact * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-stone-500">
                  {Math.round(c.impact * 100)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
