import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { CategoryBreakdownItem } from '../../types/dashboard'

interface Props {
  categories: CategoryBreakdownItem[]
  isLive?: boolean
}

function formatMinutes(m: number): string {
  if (m < 1) return `${Math.round(m * 60)}s`
  if (Number.isInteger(m)) return `${m}m`
  return `${m}m`
}

export default function CategoryBreakdown({ categories, isLive }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (categories.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="section-heading">Time by category</h2>
        <p className="section-desc">No usage tracked yet</p>
        <p className="mt-4 text-sm text-stone-500">
          Install and sign into the WellSense browser extension to see today&apos;s real category breakdown here.
        </p>
      </div>
    )
  }

  function toggle(key: string) {
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-heading">Time by category</h2>
        {isLive && (
          <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
            From extension
          </span>
        )}
      </div>
      <p className="section-desc">Today&apos;s real usage — click a category to see sites</p>
      <div className="mt-3 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categories}
              dataKey="minutes"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={68}
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
              onClick={(_, index) => {
                const item = categories[index]
                if (item) toggle(item.key)
              }}
              style={{ cursor: 'pointer' }}
            >
              {categories.map((c) => (
                <Cell key={c.key} fill={c.color} opacity={expandedKey && expandedKey !== c.key ? 0.45 : 1} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #e7e5e4',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              formatter={(value) => [`${value} min`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 space-y-1">
        {categories.map((c) => {
          const open = expandedKey === c.key
          const hasSites = c.sites.length > 0
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => toggle(c.key)}
                className={`flex w-full items-center justify-between rounded-md px-1.5 py-1.5 text-left text-sm transition-colors ${
                  open ? 'bg-stone-100' : 'hover:bg-stone-50'
                }`}
              >
                <span className="flex items-center gap-2 text-stone-700">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                  {c.category}
                  {hasSites && (
                    <span className="text-[11px] font-normal text-stone-400">
                      {open ? '▾' : '▸'} {c.sites.length} site{c.sites.length === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-stone-500">{formatMinutes(c.minutes)}</span>
              </button>
              {open && (
                <ul className="mb-1 ml-5 mt-0.5 space-y-1 border-l border-stone-200 pl-3">
                  {hasSites ? (
                    c.sites.map((site) => (
                      <li
                        key={site.domain}
                        className="flex items-center justify-between gap-3 text-xs text-stone-600"
                      >
                        <span className="truncate font-medium text-stone-700">{site.domain}</span>
                        <span className="shrink-0 tabular-nums text-stone-500">
                          {formatMinutes(site.minutes)}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-stone-500">
                      No per-site detail yet for this slice. Reload the extension (v1.2+) and browse a bit —
                      new time is tracked per domain. Older &quot;Other&quot; minutes from before this update
                      won&apos;t list sites unless you reset today&apos;s totals in the popup.
                    </li>
                  )}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
