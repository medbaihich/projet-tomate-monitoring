import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useThemeMode } from '@/theme-mode-context'

const toneClasses = {
  dark: {
    default: 'border-[#1c2624] bg-[linear-gradient(180deg,rgba(18,26,24,0.98),rgba(12,18,17,0.98))] text-slate-50 shadow-[0_18px_42px_rgba(0,0,0,0.24)]',
    subtle: 'border-[#1c2624] bg-[linear-gradient(180deg,rgba(33,59,46,0.72),rgba(13,18,17,0.98)_42%)] text-slate-50 shadow-[0_18px_42px_rgba(0,0,0,0.24)]',
    alert: 'border-[#5b2525] bg-[linear-gradient(180deg,rgba(87,20,20,0.88),rgba(16,16,16,0.98)_42%)] text-slate-50 shadow-[0_18px_42px_rgba(83,20,20,0.28)]',
  },
  light: {
    default: 'border-[#d8e4da] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,244,0.98))] text-slate-950 shadow-[0_16px_34px_rgba(22,48,35,0.06)]',
    subtle: 'border-[#d8e4da] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(239,246,240,0.96)_44%)] text-slate-950 shadow-[0_16px_34px_rgba(22,48,35,0.06)]',
    alert: 'border-[#ecc7c2] bg-[linear-gradient(180deg,rgba(255,248,247,0.98),rgba(251,238,236,0.98)_44%)] text-slate-950 shadow-[0_16px_34px_rgba(195,71,53,0.08)]',
  },
}

export default function DashboardSection({
  title,
  subtitle,
  badgeLabel,
  action,
  children,
  className,
  contentClassName,
  tone = 'default',
  style,
}) {
  const { mode } = useThemeMode()
  const isLightMode = mode === 'light'
  const paletteMode = isLightMode ? 'light' : 'dark'

  return (
    <Card
      className={cn(
        'min-w-0 rounded-[22px] border backdrop-blur-sm',
        toneClasses[paletteMode][tone] ?? toneClasses[paletteMode].default,
        className,
      )}
      style={style}
    >
      {(title || subtitle || badgeLabel || action) ? (
        <>
          <CardHeader className="space-y-2.5 p-4 pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {title ? (
                    <CardTitle className={cn(
                      'font-display text-[0.95rem] uppercase tracking-[0.08em]',
                      isLightMode ? 'text-slate-950' : 'text-slate-50',
                    )}>
                      {title}
                    </CardTitle>
                  ) : null}
                  {badgeLabel ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em]',
                        isLightMode
                          ? 'border-emerald-200 bg-emerald-50/90 text-emerald-800'
                          : 'border-white/10 bg-white/[0.06] text-emerald-300',
                      )}
                    >
                      {badgeLabel}
                    </Badge>
                  ) : null}
                </div>
                {subtitle ? (
                  <CardDescription className={cn(
                    'line-clamp-2 text-xs leading-5',
                    isLightMode ? 'text-slate-500' : 'text-slate-400',
                  )}>
                    {subtitle}
                  </CardDescription>
                ) : null}
              </div>
              {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            <Separator className={isLightMode ? 'bg-slate-200/90' : 'bg-white/8'} />
          </CardHeader>
          <CardContent className={cn('min-w-0 p-4 pt-0', contentClassName)}>
            {children}
          </CardContent>
        </>
      ) : (
        <CardContent className={cn('min-w-0', contentClassName)}>{children}</CardContent>
      )}
    </Card>
  )
}
