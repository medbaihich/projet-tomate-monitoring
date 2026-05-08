import { AlertCircle } from 'lucide-react'
import DashboardSection from '@/features/dashboard/components/DashboardSection'

export default function DashboardEmptyState({
  title = 'No data available',
  message = 'There is nothing to show for this dashboard section right now.',
  badgeLabel = 'Empty',
  framed = true,
}) {
  const content = (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-400">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="max-w-md text-sm leading-6 text-slate-400">{message}</p>
      </div>
    </div>
  )

  if (!framed) {
    return content
  }

  return (
    <DashboardSection badgeLabel={badgeLabel} contentClassName="p-0">
      {content}
    </DashboardSection>
  )
}
