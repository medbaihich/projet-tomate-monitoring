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
  danger: {
    rail: 'bg-red-300',
    panel: 'from-red-500/30 via-red-500/12 to-transparent',
    chip: 'border-red-300/30 bg-red-500/18 text-red-100',
    trend: 'border-red-300/20 bg-red-500/10 text-red-100',
    icon: 'border-red-300/26 bg-red-500/18 text-red-100',
  },
  warning: {
    rail: 'bg-amber-300',
    panel: 'from-amber-400/24 via-amber-400/10 to-transparent',
    chip: 'border-amber-300/28 bg-amber-400/14 text-amber-100',
    trend: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
    icon: 'border-amber-300/28 bg-amber-400/14 text-amber-100',
  },
}

export default function DashboardMetricCard({
  title,
  value,
  helper,
  secondaryHelper,
  chipLabel,
  trendLabel,
  footerLabel,
  accent = 'primary',
  icon,
  className,
  onClick,
  disabled = false,
  ariaLabel,
  pulse = false,
  emphasized = false,
}) {
  const accentClass = accentClasses[accent] ?? accentClasses.primary
  const isInteractive = typeof onClick === 'function' && !disabled

  return (
    <>
      {pulse ? (
        <style>{`
          @keyframes dashboardMetricUnreadPulse {
            0%, 100% {
              transform: translateY(0);
              box-shadow: 0 18px 42px rgba(127, 29, 29, 0.24), 0 0 0 0 rgba(248, 113, 113, 0.18);
            }
            50% {
              transform: translateY(-1px);
              box-shadow: 0 22px 54px rgba(127, 29, 29, 0.34), 0 0 0 8px rgba(248, 113, 113, 0.04);
            }
          }
        `}</style>
      ) : null}

      <DashboardSection
        className={cn(
          'relative h-full min-w-0 w-full overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,rgba(16,23,21,0.98),rgba(9,14,13,0.99))] transition-colors',
          emphasized && 'border-red-300/40 bg-[linear-gradient(180deg,rgba(88,18,18,0.98),rgba(24,8,8,0.99))] shadow-[0_22px_54px_rgba(127,29,29,0.34)]',
          isInteractive ? 'hover:border-white/20' : '',
          disabled ? 'opacity-90' : '',
          className,
        )}
        contentClassName="p-3"
        style={pulse ? { animation: 'dashboardMetricUnreadPulse 2.6s ease-in-out infinite' } : undefined}
      >
        <div className={cn('absolute inset-x-0 top-0 h-0.5', accentClass.rail)} />
        <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100', accentClass.panel)} />
        {pulse ? (
          <div className="pointer-events-none absolute inset-0 rounded-[18px] border border-red-300/22 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.14)]" />
        ) : null}
        <div
          className={cn(
            'relative flex min-h-[110px] min-w-0 flex-col justify-between gap-2',
            isInteractive ? 'transition-transform duration-200 hover:-translate-y-0.5' : '',
          )}
        >
          <button
            type="button"
            onClick={isInteractive ? onClick : undefined}
            disabled={!isInteractive}
            aria-label={ariaLabel || title}
            className={cn(
              'absolute inset-0 z-10 rounded-[18px]',
              isInteractive ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950' : 'cursor-default',
            )}
          />
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              {icon ? (
                <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg border [&_svg]:h-4 [&_svg]:w-4', accentClass.icon)}>
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0">
                <p className={cn('line-clamp-2 text-[0.6rem] font-semibold uppercase leading-4 tracking-[0.14em]', pulse ? 'text-red-100/90' : 'text-slate-400')}>
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
              <p className={cn('line-clamp-1 text-[0.7rem] leading-4', pulse ? 'text-red-100/85' : 'text-slate-400')}>
                {helper}
              </p>
            ) : null}
            {secondaryHelper ? (
              <p className={cn('line-clamp-1 text-[0.66rem] leading-4', pulse ? 'text-red-100/72' : 'text-slate-500')}>
                {secondaryHelper}
              </p>
            ) : null}
          </div>

          {footerLabel ? (
            <div className="space-y-1">
              <Separator className={cn(pulse ? 'bg-red-200/12' : 'bg-white/8')} />
              <p className={cn('truncate text-[0.62rem] font-medium tracking-[0.02em]', pulse ? 'text-red-100/70' : 'text-slate-500')}>
                {footerLabel}
              </p>
            </div>
          ) : null}
        </div>
      </DashboardSection>
    </>
  )
}
