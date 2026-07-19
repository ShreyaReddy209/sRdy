import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Point {
  day: string
  score: number
}

interface Props {
  forecast: Point[]
}

export default function ForecastChart({ forecast }: Props) {
  const data = forecast.map((p) => ({ ...p, pct: Math.round(p.score * 100) }))

  return (
    <div className="card p-5">
      <h2 className="section-heading">7-day forecast</h2>
      <p className="section-desc">Predicted risk trend from the LSTM model</p>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: '#78716c', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#78716c', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #e7e5e4',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              formatter={(value) => [`${value}%`, 'Risk']}
            />
            <Area
              type="monotone"
              dataKey="pct"
              stroke="#0d9488"
              strokeWidth={2}
              fill="url(#forecastFill)"
              dot={{ r: 3, fill: '#0d9488', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
