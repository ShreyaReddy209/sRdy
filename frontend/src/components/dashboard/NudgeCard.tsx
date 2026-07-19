import type { CoachTone } from '../../services/userData'

interface Props {
  message: string
  windowStart: string
  windowEnd: string
  tone: CoachTone
  read: boolean
  onToneChange: (tone: CoachTone) => void
  onMarkRead: () => void
}

const TONES: { value: CoachTone; label: string }[] = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'direct', label: 'Direct' },
]

export default function NudgeCard({ message, windowStart, windowEnd, tone, read, onToneChange, onMarkRead }: Props) {
  return (
    <div className="card border-l-4 border-l-teal-600 p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-heading">Scheduled nudge</h2>
        <div className="flex rounded-md border border-stone-200 p-0.5">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onToneChange(t.value)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                tone === t.value
                  ? 'bg-teal-700 text-white'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <p className="section-desc">
        {windowStart && windowEnd
          ? `Window: ${windowStart}–${windowEnd} (based on your tracked late-evening activity)`
          : 'No specific time window yet — needs a few more days of tracked activity'}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-stone-700">{message}</p>
      <button
        type="button"
        onClick={onMarkRead}
        disabled={read}
        className="btn-accent mt-4 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {read ? 'Marked as read' : 'Mark as read'}
      </button>
    </div>
  )
}
