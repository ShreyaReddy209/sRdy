import { useDashboardData } from '../context/DashboardDataContext'
import NudgeCard from '../components/dashboard/NudgeCard'
import DataStateNotice from '../components/dashboard/DataStateNotice'

export default function CoachPage() {
  const { data, coachTone, nudgeRead, predictionStatus, hasLiveData, loadingUserData, handleToneChange, markNudgeRead } =
    useDashboardData()

  const noRealNudge =
    loadingUserData || predictionStatus === 'no-data' || ((predictionStatus === 'fallback' || predictionStatus === 'error') && !hasLiveData)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Coach</h1>
        <p className="page-desc">Proactive nudges timed to your relapse window, in the tone you prefer.</p>
      </div>

      <div className="max-w-xl">
        {noRealNudge ? (
          <DataStateNotice
            tone={predictionStatus === 'fallback' || predictionStatus === 'error' ? 'error' : 'empty'}
            title={loadingUserData ? 'Loading…' : predictionStatus === 'no-data' ? 'No nudge yet' : 'Backend unreachable'}
            message={
              loadingUserData
                ? 'Fetching your data.'
                : predictionStatus === 'no-data'
                  ? 'Complete a check-in or install the browser extension so the coach has something real to respond to.'
                  : 'The prediction API is not responding, so there is no nudge to show yet.'
            }
          />
        ) : (
          <NudgeCard
            message={data.nudge.message}
            windowStart={data.nudge.windowStart}
            windowEnd={data.nudge.windowEnd}
            tone={coachTone}
            read={nudgeRead}
            onToneChange={handleToneChange}
            onMarkRead={markNudgeRead}
          />
        )}
      </div>
    </div>
  )
}
