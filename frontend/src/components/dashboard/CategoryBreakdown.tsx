import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface Category {
  category: string
  minutes: number
  color: string
}

interface Props {
  categories: Category[]
  isLive?: boolean
}

export default function CategoryBreakdown({ categories, isLive }: Props) {
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
      <p className="section-desc">Today&apos;s real usage</p>
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
            >
              {categories.map((c) => (
                <Cell key={c.category} fill={c.color} />
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
      <ul className="mt-3 space-y-1.5">
        {categories.map((c) => (
          <li key={c.category} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-stone-700">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.category}
            </span>
            <span className="tabular-nums text-stone-500">{c.minutes}m</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
