interface Props {
  title: string
  message: string
  tone?: 'empty' | 'error'
}

/** Shown instead of any chart/metric when there is no real data to back it — never fabricated numbers. */
export default function DataStateNotice({ title, message, tone = 'empty' }: Props) {
  return (
    <div className={`card p-8 text-center ${tone === 'error' ? 'border border-red-200 bg-red-50/40' : ''}`}>
      <p className="text-sm font-medium text-stone-900">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-stone-600">{message}</p>
    </div>
  )
}
