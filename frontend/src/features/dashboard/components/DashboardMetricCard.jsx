import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import DashboardSection from '@/features/dashboard/components/DashboardSection'
import { useThemeMode } from '@/theme-mode-context'

const accentClasses = {
  dark: {
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
  },
  light: {
    primary: {
      rail: 'bg-emerald-500',
      panel: 'from-emerald-500/10 via-emerald-500/[0.04] to-transparent',
      chip: 'border-emerald-200 bg-emerald-50/90 text-emerald-800',
      trend: 'border-emerald-200 bg-emerald-50/80 text-emerald-800',
      icon: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    neutral: {
      rail: 'bg-slate-400',
      panel: 'from-slate-400/10 via-slate-400/[0.03] to-transparent',
      chip: 'border-slate-200 bg-slate-50/90 text-slate-700',
      trend: 'border-slate-200 bg-slate-50/80 text-slate-700',
      icon: 'border-slate-200 bg-slate-50 text-slate-600',
    },
    info: {
      rail: 'bg-teal-500',
      panel: 'from-teal-500/10 via-teal-500/[0.04] to-transparent',
      chip: 'border-teal-200 bg-teal-50/90 text-teal-800',
      trend: 'border-teal-200 bg-teal-50/80 text-teal-800',
      icon: 'border-teal-200 bg-teal-50 text-teal-700',
    },
    success: {
      rail: 'bg-lime-500',
      panel: 'from-lime-500/10 via-lime-500/[0.04] to-transparent',
      chip: 'border-lime-200 bg-lime-50/90 text-lime-800',
      trend: 'border-lime-200 bg-lime-50/80 text-lime-800',
      icon: 'border-lime-200 bg-lime-50 text-lime-700',
    },
    alert: {
      rail: 'bg-red-500',
      panel: 'from-red-500/10 via-red-500/[0.04] to-transparent',
      chip: 'border-red-200 bg-red-50/90 text-red-800',
      trend: 'border-red-200 bg-red-50/80 text-red-800',
      icon: 'border-red-200 bg-red-50 text-red-700',
    },
    danger: {
      rail: 'bg-red-500',
      panel: 'from-red-500/16 via-red-500/[0.06] to-transparent',
      chip: 'border-red-200 bg-red-50/95 text-red-800',
      trend: 'border-red-200 bg-red-50/85 text-red-800',
      icon: 'border-red-200 bg-red-50 text-red-700',
    },
    warning: {
      rail: 'bg-amber-500',
      panel: 'from-amber-500/14 via-amber-500/[0.06] to-transparent',
      chip: 'border-amber-200 bg-amber-50/95 text-amber-800',
      trend: 'border-amber-200 bg-amber-50/85 text-amber-800',
      icon: 'border-amber-200 bg-amber-50 text-amber-700',
    },
  },
}

const attentionClasses = {
  dark: {
    danger: {
      panelShell: 'border-red-300/40 bg-[linear-gradient(180deg,rgba(88,18,18,0.98),rgba(24,8,8,0.99))] shadow-[0_22px_54px_rgba(127,29,29,0.34)]',
      overlay: 'border-red-300/22 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.14)]',
      title: 'text-red-100/90',
      helper: 'text-red-100/85',
      secondaryHelper: 'text-red-100/72',
      separator: 'bg-red-200/12',
      footer: 'text-red-100/70',
      pulseStyle: {
        '--dashboard-metric-pulse-shadow-rest': '0 18px 42px rgba(127, 29, 29, 0.24)',
        '--dashboard-metric-pulse-shadow-active': '0 22px 54px rgba(127, 29, 29, 0.34)',
        '--dashboard-metric-pulse-ring-rest': 'rgba(248, 113, 113, 0.18)',
        '--dashboard-metric-pulse-ring-active': 'rgba(248, 113, 113, 0.04)',
      },
    },
    warning: {
      panelShell: 'border-amber-300/40 bg-[linear-gradient(180deg,rgba(94,68,11,0.98),rgba(32,22,6,0.99))] shadow-[0_22px_54px_rgba(120,84,12,0.3)]',
      overlay: 'border-amber-200/24 shadow-[inset_0_0_0_1px_rgba(253,224,71,0.16)]',
      title: 'text-amber-50/95',
      helper: 'text-amber-50/85',
      secondaryHelper: 'text-amber-100/72',
      separator: 'bg-amber-200/16',
      footer: 'text-amber-100/72',
      pulseStyle: {
        '--dashboard-metric-pulse-shadow-rest': '0 18px 42px rgba(120, 84, 12, 0.22)',
        '--dashboard-metric-pulse-shadow-active': '0 22px 54px rgba(120, 84, 12, 0.32)',
        '--dashboard-metric-pulse-ring-rest': 'rgba(253, 224, 71, 0.16)',
        '--dashboard-metric-pulse-ring-active': 'rgba(253, 224, 71, 0.05)',
      },
    },
  },
  light: {
    danger: {
      panelShell: 'border-red-200 bg-[linear-gradient(180deg,rgba(255,246,246,0.98),rgba(255,236,236,0.98))] shadow-[0_16px_34px_rgba(195,71,53,0.12)]',
      overlay: 'border-red-200/80 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.12)]',
      title: 'text-red-900/88',
      helper: 'text-red-900/82',
      secondaryHelper: 'text-red-800/68',
      separator: 'bg-red-200/70',
      footer: 'text-red-800/72',
      pulseStyle: {
        '--dashboard-metric-pulse-shadow-rest': '0 12px 24px rgba(195, 71, 53, 0.10)',
        '--dashboard-metric-pulse-shadow-active': '0 18px 34px rgba(195, 71, 53, 0.16)',
        '--dashboard-metric-pulse-ring-rest': 'rgba(248, 113, 113, 0.14)',
        '--dashboard-metric-pulse-ring-active': 'rgba(248, 113, 113, 0.03)',
      },
    },
    warning: {
      panelShell: 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,238,0.98),rgba(255,244,214,0.98))] shadow-[0_16px_34px_rgba(217,154,30,0.12)]',
      overlay: 'border-amber-200/90 shadow-[inset_0_0_0_1px_rgba(253,224,71,0.14)]',
      title: 'text-amber-950/88',
      helper: 'text-amber-950/82',
      secondaryHelper: 'text-amber-900/68',
      separator: 'bg-amber-200/75',
      footer: 'text-amber-900/72',
      pulseStyle: {
        '--dashboard-metric-pulse-shadow-rest': '0 12px 24px rgba(217, 154, 30, 0.10)',
        '--dashboard-metric-pulse-shadow-active': '0 18px 34px rgba(217, 154, 30, 0.16)',
        '--dashboard-metric-pulse-ring-rest': 'rgba(253, 224, 71, 0.14)',
        '--dashboard-metric-pulse-ring-active': 'rgba(253, 224, 71, 0.04)',
      },
    },
  },
}

const surfaceClasses = {
  dark: {
    card: 'border-[#1c2624] bg-[linear-gradient(180deg,rgba(16,23,21,0.98),rgba(9,14,13,0.99))] shadow-[0_18px_42px_rgba(0,0,0,0.24)]',
    title: 'text-slate-400',
    value: 'text-slate-50',
    helper: 'text-slate-400',
    secondaryHelper: 'text-slate-500',
    insightTile: 'border-white/8 bg-black/20',
    insightLabel: 'text-slate-500',
    insightValue: 'text-slate-100',
    separator: 'bg-white/8',
    focusOffset: 'focus-visible:ring-offset-slate-950',
  },
  light: {
    card: 'border-[#d8e4da] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,244,0.98))] shadow-[0_14px_30px_rgba(22,48,35,0.06)]',
    title: 'text-slate-500',
    value: 'text-slate-950',
    helper: 'text-slate-700',
    secondaryHelper: 'text-slate-500',
    insightTile: 'border-slate-200/80 bg-white/78',
    insightLabel: 'text-slate-500',
    insightValue: 'text-slate-900',
    separator: 'bg-slate-200/90',
    focusOffset: 'focus-visible:ring-offset-[#f5f8f5]',
  },
}

export default function DashboardMetricCard({
  title,
  value,
  helper,
  secondaryHelper,
  insightItems,
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
  attentionTone = 'danger',
  wrapValue = false,
}) {
  const { mode } = useThemeMode()
  const isLightMode = mode === 'light'
  const paletteMode = isLightMode ? 'light' : 'dark'
  const accentClass = accentClasses[paletteMode][accent] ?? accentClasses[paletteMode].primary
  const attentionClass = attentionClasses[paletteMode][attentionTone] ?? attentionClasses[paletteMode].danger
  const surfaceClass = surfaceClasses[paletteMode]
  const attentionActive = pulse || emphasized
  const isInteractive = typeof onClick === 'function' && !disabled

  return (
    <>
      {pulse ? (
        <style>{`
          @keyframes dashboardMetricAttentionPulse {
            0%, 100% {
              transform: translateY(0);
              box-shadow: var(--dashboard-metric-pulse-shadow-rest), 0 0 0 0 var(--dashboard-metric-pulse-ring-rest);
            }
            50% {
              transform: translateY(-1px);
              box-shadow: var(--dashboard-metric-pulse-shadow-active), 0 0 0 8px var(--dashboard-metric-pulse-ring-active);
            }
          }
        `}</style>
      ) : null}

      <DashboardSection
        className={cn(
          'relative h-full min-w-0 w-full overflow-hidden rounded-[18px] transition-colors',
          surfaceClass.card,
          attentionActive && attentionClass.panelShell,
          isInteractive ? (isLightMode ? 'hover:border-slate-300' : 'hover:border-white/20') : '',
          disabled ? 'opacity-90' : '',
          className,
        )}
        contentClassName="p-3"
        style={pulse ? { animation: 'dashboardMetricAttentionPulse 2.6s ease-in-out infinite', ...attentionClass.pulseStyle } : undefined}
      >
        <div className={cn('absolute inset-x-0 top-0 h-0.5', accentClass.rail)} />
        <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100', accentClass.panel)} />
        {attentionActive ? (
          <div className={cn('pointer-events-none absolute inset-0 rounded-[18px] border', attentionClass.overlay)} />
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
              isInteractive ? cn('cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2', surfaceClass.focusOffset) : 'cursor-default',
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
                <p className={cn('line-clamp-2 text-[0.6rem] font-semibold uppercase leading-4 tracking-[0.14em]', attentionActive ? attentionClass.title : surfaceClass.title)}>
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
            <div className={cn('flex justify-between gap-2', wrapValue ? 'items-start' : 'items-end')}>
              <p className={cn(
                'min-w-0 text-[clamp(1.24rem,0.95rem+0.64vw,1.72rem)] font-semibold tracking-[-0.05em]',
                attentionActive ? attentionClass.title : surfaceClass.value,
                wrapValue ? 'line-clamp-2 whitespace-normal leading-tight' : 'truncate leading-none',
              )}>
                {value}
              </p>
              {trendLabel ? (
                <Badge variant="outline" className={cn('max-w-[44%] shrink-0 truncate rounded-full px-1.5 py-0.5 text-[0.56rem] font-medium', accentClass.trend)}>
                  {trendLabel}
                </Badge>
              ) : null}
            </div>

            {helper ? (
              <p className={cn('line-clamp-1 text-[0.7rem] leading-4', attentionActive ? attentionClass.helper : surfaceClass.helper)}>
                {helper}
              </p>
            ) : null}
            {secondaryHelper ? (
              <p className={cn('line-clamp-1 text-[0.66rem] leading-4', attentionActive ? attentionClass.secondaryHelper : surfaceClass.secondaryHelper)}>
                {secondaryHelper}
              </p>
            ) : null}

            {insightItems?.length ? (
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                {insightItems.map((item) => (
                  <div
                    key={item.label}
                    className={cn('rounded-xl border px-2 py-1.5', attentionActive ? attentionClass.overlay : surfaceClass.insightTile)}
                  >
                    <p className={cn('text-[0.56rem] font-semibold uppercase tracking-[0.12em]', attentionActive ? attentionClass.secondaryHelper : surfaceClass.insightLabel)}>
                      {item.label}
                    </p>
                    <p className={cn('mt-0.5 truncate text-[0.74rem] font-semibold tabular-nums', attentionActive ? attentionClass.helper : surfaceClass.insightValue)}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {footerLabel ? (
            <div className="space-y-1">
              <Separator className={cn(attentionActive ? attentionClass.separator : surfaceClass.separator)} />
              <p className={cn('truncate text-[0.62rem] font-medium tracking-[0.02em]', attentionActive ? attentionClass.footer : 'text-slate-500')}>
                {footerLabel}
              </p>
            </div>
          ) : null}
        </div>
      </DashboardSection>
    </>
  )
}
