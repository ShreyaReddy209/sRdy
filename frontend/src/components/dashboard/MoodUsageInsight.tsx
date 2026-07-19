interface Props {
  highStressAvgMin: number
  lowStressAvgMin: number
  pctDiff: number
  sampleSize: number
  personalized: boolean
}

export default function MoodUsageInsight({
  highStressAvgMin,
  lowStressAvgMin,
  pctDiff,
  sampleSize,
  personalized,
}: Props) {
  const worse = pctDiff > 0

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-heading">Mood &amp; usage</h2>
        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
          {personalized ? 'Your data' : 'Cohort data'}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stone-700">
        {personalized ? 'On your high-stress days' : 'On high-stress days'}, distracting-app time averages{' '}
        <span className="font-semibold text-stone-900">{highStressAvgMin} min</span>, compared to{' '}
        <span className="font-semibold text-stone-900">{lowStressAvgMin} min</span> on low-stress days —{' '}
        {worse ? (
          <span className="font-medium text-orange-700">{Math.abs(pctDiff)}% more</span>
        ) : (
          <span className="font-medium text-emerald-700">{Math.abs(pctDiff)}% less</span>
        )}{' '}
        screen time when stressed.
      </p>
      <p className="mt-2 text-xs text-stone-400">
        {personalized
          ? `Based on ${sampleSize} of your own check-in days.`
          : `Based on ${sampleSize.toLocaleString()} days across similar users.`}
      </p>
    </div>
  )
}
