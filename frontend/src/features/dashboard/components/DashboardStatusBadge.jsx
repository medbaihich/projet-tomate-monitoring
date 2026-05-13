import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { resolveDashboardStatusTone } from '@/features/dashboard/components/dashboardPresentation'
import { useThemeMode } from '@/theme-mode-context'

const toneClasses = {
  dark: {
    neutral: 'border-slate-300/18 bg-white/[0.04] text-slate-300',
    new: 'border-sky-400/20 bg-sky-500/12 text-sky-200',
    review: 'border-amber-400/22 bg-amber-500/12 text-amber-200',
    completed: 'border-emerald-400/22 bg-emerald-500/12 text-emerald-200',
    processing: 'border-violet-400/22 bg-violet-500/12 text-violet-200',
    failed: 'border-red-400/22 bg-red-500/12 text-red-200',
    alert: 'border-red-400/22 bg-red-500/12 text-red-200',
  },
  light: {
    neutral: 'border-slate-200 bg-white/90 text-slate-600',
    new: 'border-sky-200 bg-sky-50/95 text-sky-800',
    review: 'border-amber-200 bg-amber-50/95 text-amber-800',
    completed: 'border-emerald-200 bg-emerald-50/95 text-emerald-800',
    processing: 'border-violet-200 bg-violet-50/95 text-violet-800',
    failed: 'border-red-200 bg-red-50/95 text-red-800',
    alert: 'border-red-200 bg-red-50/95 text-red-800',
  },
}

export default function DashboardStatusBadge({ label, tone, className }) {
  const { mode } = useThemeMode()
  const resolvedTone = tone ?? resolveDashboardStatusTone(label)
  const paletteMode = mode === 'light' ? 'light' : 'dark'

  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em]',
        toneClasses[paletteMode][resolvedTone] ?? toneClasses[paletteMode].neutral,
        className,
      )}
    >
      {label || 'Unknown'}
    </Badge>
  )
}
