interface Props {
  mood: number
  stress: number
  sleep: number
  loading?: boolean
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  onChange?: (field: 'mood' | 'stress' | 'sleep', value: number) => void
}

function TapScale({
  label,
  value,
  low,
  high,
  onChange,
}: {
  label: string
  value: number
  low: string
  high: string
  onChange?: (v: number) => void
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-stone-700">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className={`h-9 flex-1 rounded-md text-sm font-medium transition ${
              value === n
                ? 'bg-teal-700 text-white'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-stone-400">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

export default function MoodCheckIn({ mood, stress, sleep, loading, saveStatus, onChange }: Props) {
  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="section-heading">Check-in</h2>
          <p className="section-desc">Tap a number for each</p>
        </div>
        {saveStatus === 'saving' && <span className="text-xs text-stone-400">Saving…</span>}
        {saveStatus === 'saved' && <span className="text-xs text-teal-700">Saved</span>}
        {saveStatus === 'error' && <span className="text-xs text-red-600">Save failed</span>}
      </div>
      {loading ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : (
        <>
          <TapScale label="Mood" value={mood} low="Low" high="Good" onChange={(v) => onChange?.('mood', v)} />
          <TapScale label="Stress" value={stress} low="Calm" high="High" onChange={(v) => onChange?.('stress', v)} />
          <TapScale label="Sleep" value={sleep} low="Poor" high="Good" onChange={(v) => onChange?.('sleep', v)} />
        </>
      )}
    </div>
  )
}
