import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { resolveDashboardStatusTone } from '@/features/dashboard/components/dashboardPresentation'

const toneClasses = {
  neutral: 'border-slate-300/18 bg-white/[0.04] text-slate-300',
  new: 'border-sky-400/20 bg-sky-500/12 text-sky-200',
  review: 'border-amber-400/22 bg-amber-500/12 text-amber-200',
  completed: 'border-emerald-400/22 bg-emerald-500/12 text-emerald-200',
  processing: 'border-violet-400/22 bg-violet-500/12 text-violet-200',
  failed: 'border-red-400/22 bg-red-500/12 text-red-200',
  alert: 'border-red-400/22 bg-red-500/12 text-red-200',
}

export default function DashboardStatusBadge({ label, tone, className }) {
  const resolvedTone = tone ?? resolveDashboardStatusTone(label)

  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em]',
        toneClasses[resolvedTone] ?? toneClasses.neutral,
        className,
      )}
    >
      {label || 'Unknown'}
    </Badge>
  )
}
