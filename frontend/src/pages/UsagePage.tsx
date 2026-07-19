import { useDashboardData } from '../context/DashboardDataContext'
import CategoryBreakdown from '../components/dashboard/CategoryBreakdown'

export default function UsagePage() {
  const { data, aggregate } = useDashboardData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Usage</h1>
        <p className="page-desc">Where your screen time actually goes today.</p>
      </div>

      <div className="max-w-md">
        <CategoryBreakdown categories={data.categoryBreakdown} isLive={aggregate !== null} />
      </div>
    </div>
  )
}
