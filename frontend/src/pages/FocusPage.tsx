import { useDashboardData } from '../context/DashboardDataContext'
import FocusModeWidget from '../components/dashboard/FocusModeWidget'

export default function FocusPage() {
  const { aggregate } = useDashboardData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Focus Mode</h1>
        <p className="page-desc">
          Today&apos;s activity, classified as productive, compulsive, or mixed from your real usage data.
        </p>
      </div>

      <div className="max-w-sm">
        <FocusModeWidget aggregate={aggregate} />
      </div>
    </div>
  )
}
