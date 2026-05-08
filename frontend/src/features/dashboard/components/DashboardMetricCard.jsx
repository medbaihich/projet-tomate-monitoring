import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import DashboardSection from '@/features/dashboard/components/DashboardSection'

const accentClasses = {
  primary: {
    rail: 'bg-emerald-400',
    panel: 'from-emerald-500/18 via-emerald-500/6 to-transparent',
    chip: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-200',
    trend: 'border-emerald-400/15 bg-white/[0.04] text-emerald-200',
    icon: 'border-emerald-400/20 bg-emerald-500/12 text-emerald-200',
  },
  neutral: {
    rail: 'bg-slate-400',
    panel: 'from-slate-400/14 via-slate-400/5 to-transparent',
    chip: 'border-slate-300/18 bg-white/[0.04] text-slate-300',
    trend: 'border-slate-300/15 bg-white/[0.04] text-slate-300',
    icon: 'border-slate-300/18 bg-white/[0.05] text-slate-200',
  },
  info: {
    rail: 'bg-teal-400',
    panel: 'from-teal-400/16 via-teal-400/6 to-transparent',
    chip: 'border-teal-400/22 bg-teal-400/12 text-teal-200',
    trend: 'border-teal-400/16 bg-white/[0.04] text-teal-200',
    icon: 'border-teal-400/22 bg-teal-400/12 text-teal-200',
  },
  success: {
    rail: 'bg-lime-400',
    panel: 'from-lime-400/16 via-lime-400/6 to-transparent',
    chip: 'border-lime-400/22 bg-lime-400/12 text-lime-200',
    trend: 'border-lime-400/16 bg-white/[0.04] text-lime-200',
    icon: 'border-lime-400/22 bg-lime-400/12 text-lime-200',
  },
  alert: {
    rail: 'bg-red-400',
    panel: 'from-red-500/20 via-red-500/8 to-transparent',
    chip: 'border-red-400/24 bg-red-500/12 text-red-200',
    trend: 'border-red-400/18 bg-white/[0.04] text-red-200',
    icon: 'border-red-400/24 bg-red-500/12 text-red-200',
  },
}

export default function DashboardMetricCard({
  title,
  value,
  helper,
  chipLabel,
  trendLabel,
  footerLabel,
  accent = 'primary',
  icon,
  className,
}) {
  const accentClass = accentClasses[accent] ?? accentClasses.primary

  return (
    <DashboardSection
      className={cn('relative h-full min-w-0 w-full overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,rgba(16,23,21,0.98),rgba(9,14,13,0.99))] transition-colors hover:border-white/20', className)}
      contentClassName="p-3"
    >
      <div className={cn('absolute inset-x-0 top-0 h-0.5', accentClass.rail)} />
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100', accentClass.panel)} />
      <div className="relative flex min-h-[110px] min-w-0 flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {icon ? (
              <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg border [&_svg]:h-4 [&_svg]:w-4', accentClass.icon)}>
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="line-clamp-2 text-[0.6rem] font-semibold uppercase leading-4 tracking-[0.14em] text-slate-400">
                {title}
              </p>
            </div>
          </div>
          {chipLabel ? (
            <Badge variant="outline" className={cn('max-w-[40%] shrink-0 truncate rounded-full px-1.5 py-0.5 text-[0.56rem] font-medium', accentClass.chip)}>
              {chipLabel}
            </Badge>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-end justify-between gap-2">
            <p className="min-w-0 truncate text-[clamp(1.24rem,0.95rem+0.64vw,1.72rem)] font-semibold leading-none tracking-[-0.05em] text-slate-50">
              {value}
            </p>
            {trendLabel ? (
              <Badge variant="outline" className={cn('max-w-[44%] shrink-0 truncate rounded-full px-1.5 py-0.5 text-[0.56rem] font-medium', accentClass.trend)}>
                {trendLabel}
              </Badge>
            ) : null}
          </div>

          {helper ? (
            <p className="line-clamp-1 text-[0.7rem] leading-4 text-slate-400">
              {helper}
            </p>
          ) : null}
        </div>

        {footerLabel ? (
          <div className="space-y-1">
            <Separator className="bg-white/8" />
            <p className="truncate text-[0.62rem] font-medium tracking-[0.02em] text-slate-500">
              {footerLabel}
            </p>
          </div>
        ) : null}
      </div>
    </DashboardSection>
  )
}
