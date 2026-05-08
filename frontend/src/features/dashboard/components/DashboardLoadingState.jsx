import { Skeleton } from '@/components/ui/skeleton'
import DashboardSection from '@/features/dashboard/components/DashboardSection'

export default function DashboardLoadingState({
  title = 'Loading',
  subtitle = 'Preparing dashboard content.',
  metricCount = 4,
}) {
  return (
    <div className="space-y-5 rounded-[32px] border border-[#1c2624] bg-[linear-gradient(180deg,rgba(12,18,17,0.98),rgba(8,12,11,0.98))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
      <DashboardSection title={title} subtitle={subtitle} badgeLabel="Loading">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: metricCount }, (_, index) => (
              <div key={`metric-skeleton-${index}`} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 shadow-panel">
                <div className="space-y-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-9 w-28" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </div>
      </DashboardSection>
    </div>
  )
}
