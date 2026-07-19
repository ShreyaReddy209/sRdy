import { useDashboardData } from '../context/DashboardDataContext'
import ExplanationPanel from '../components/dashboard/ExplanationPanel'
import MoodUsageInsight from '../components/dashboard/MoodUsageInsight'
import DataStateNotice from '../components/dashboard/DataStateNotice'

export default function InsightsPage() {
  const { data, moodInsight, predictionStatus, hasLiveData, loadingUserData } = useDashboardData()

  const header = (
    <div>
      <h1 className="page-title">Insights</h1>
      <p className="page-desc">Why the model scored you this way, and how you compare to a modeled population.</p>
    </div>
  )

  const noRealPrediction =
    loadingUserData || predictionStatus === 'no-data' || ((predictionStatus === 'fallback' || predictionStatus === 'error') && !hasLiveData)

  return (
    <div className="space-y-6">
      {header}

      {noRealPrediction ? (
        <DataStateNotice
          tone={predictionStatus === 'fallback' || predictionStatus === 'error' ? 'error' : 'empty'}
          title={loadingUserData ? 'Loading…' : predictionStatus === 'no-data' ? 'Nothing to explain yet' : 'Backend unreachable'}
          message={
            loadingUserData
              ? 'Fetching your data.'
              : predictionStatus === 'no-data'
                ? 'Complete a check-in or install the browser extension to generate your first explanation.'
                : 'The prediction API is not responding, so there is no explanation to show yet.'
          }
        />
      ) : (
        <ExplanationPanel explanation={data.explanation} contributors={data.contributors} />
      )}

      {moodInsight && <MoodUsageInsight {...moodInsight} />}

      {!noRealPrediction && data.cohortPercentile !== null && (
        <div className="card p-5">
          <h2 className="section-heading">Cohort benchmark</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">
            You're doing better than{' '}
            <span className="font-semibold text-stone-900">{data.cohortPercentile}%</span> of a modeled
            population in our training dataset, based on today's risk score.
          </p>
          <p className="mt-2 text-xs text-stone-400">
            This benchmark compares you to a statistically modeled population, not other live users of this app.
          </p>
        </div>
      )}
    </div>
  )
}
