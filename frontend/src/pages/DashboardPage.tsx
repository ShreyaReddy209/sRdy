import { useDashboardData } from '../context/DashboardDataContext'
import RiskHero from '../components/dashboard/RiskHero'
import ForecastChart from '../components/dashboard/ForecastChart'
import FocusModeWidget from '../components/dashboard/FocusModeWidget'
import CategoryBreakdown from '../components/dashboard/CategoryBreakdown'
import DataStateNotice from '../components/dashboard/DataStateNotice'

export default function DashboardPage() {
  const { data, predictionStatus, statusMessage, aggregate, hasLiveData, loadingUserData } = useDashboardData()

  const header = (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-desc">{statusMessage}</p>
      {predictionStatus === 'live' && (
        <span className="mt-1 inline-block rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
          Live model
        </span>
      )}
      {(predictionStatus === 'fallback' || predictionStatus === 'error') && (
        <span className="mt-1 inline-block rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
          {hasLiveData ? 'Showing last known result' : 'No prediction available'}
        </span>
      )}
    </div>
  )

  if (loadingUserData) {
    return (
      <div className="space-y-6">
        {header}
        <DataStateNotice title="Loading your data…" message="Fetching your check-ins and usage history." />
      </div>
    )
  }

  if (predictionStatus === 'no-data') {
    return (
      <div className="space-y-6">
        {header}
        <DataStateNotice
          title="No prediction yet"
          message="We don't have any real activity to analyze. Complete today's check-in or install the browser extension to get your first risk assessment."
        />
      </div>
    )
  }

  if ((predictionStatus === 'fallback' || predictionStatus === 'error') && !hasLiveData) {
    return (
      <div className="space-y-6">
        {header}
        <DataStateNotice
          tone="error"
          title="Backend unreachable"
          message="The prediction API isn't responding, so there's nothing real to show yet. Start it with: uvicorn app.main:app --reload"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      <RiskHero riskLevel={data.riskLevel} riskScore={data.riskScore} streakDays={data.streakDays} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ForecastChart forecast={data.forecast} />
        </div>
        <div className="space-y-5">
          <FocusModeWidget aggregate={aggregate} />
          {data.cohortPercentile !== null && (
            <div className="card p-4 text-center">
              <p className="text-2xl font-semibold text-stone-900">{data.cohortPercentile}%</p>
              <p className="mt-1 text-sm text-stone-500">of a modeled population have higher risk than you</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-md">
        <CategoryBreakdown categories={data.categoryBreakdown} isLive={aggregate !== null} />
      </div>
    </div>
  )
}
