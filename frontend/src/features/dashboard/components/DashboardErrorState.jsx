import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DashboardSection from '@/features/dashboard/components/DashboardSection'

export default function DashboardErrorState({
  title = 'Dashboard unavailable',
  message = 'The dashboard data could not be loaded.',
  onRetry,
  framed = true,
}) {
  const content = (
    <div className="flex min-h-32 items-center gap-4 rounded-2xl border border-red-400/22 bg-red-500/12 px-5 py-4 text-red-100">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-red-400/22 bg-red-500/16">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">Unable to prepare this dashboard view.</p>
        <p className="text-sm leading-6 text-red-200/90">
          {message}
        </p>
      </div>
    </div>
  )

  if (!framed) {
    return content
  }

  return (
    <DashboardSection
      title={title}
      subtitle={message}
      badgeLabel="Error"
      tone="alert"
      action={onRetry ? <Button variant="destructive" size="sm" onClick={onRetry}>Retry</Button> : null}
      contentClassName="pt-0"
    >
      {content}
    </DashboardSection>
  )
}
