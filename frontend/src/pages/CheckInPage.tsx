import { useDashboardData } from '../context/DashboardDataContext'
import DailyGoalSelector from '../components/dashboard/DailyGoalSelector'
import MoodCheckIn from '../components/dashboard/MoodCheckIn'

export default function CheckInPage() {
  const { data, loadingUserData, checkInStatus, handleGoalSelect, handleMoodChange } = useDashboardData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Daily Check-in</h1>
        <p className="page-desc">Set today's goal and log your mood, stress, and sleep — takes about 10 seconds.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <DailyGoalSelector selected={data.dailyGoal} onSelect={handleGoalSelect} loading={loadingUserData} />
        <MoodCheckIn
          {...data.mood}
          onChange={handleMoodChange}
          saveStatus={checkInStatus}
          loading={loadingUserData}
        />
      </div>
    </div>
  )
}
