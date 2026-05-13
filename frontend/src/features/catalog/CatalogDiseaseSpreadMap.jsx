import { useMemo } from 'react';
import PanelCard from '@/components/ui/PanelCard';
import StateBlock from '@/components/ui/StateBlock';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useThemeMode } from '@/theme-mode-context';

const ORGAN_LABELS = {
  fruit: 'Fruit',
  leaf: 'Leaf',
};

const RISK_FALLBACK_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#16a34a',
};

const ZONE_FALLBACK_COLORS = {
  infection_zone: '#dc2626',
  vector_risk_zone: '#7c3aed',
  agronomic_risk_zone: '#d97706',
  risk_zone: '#2563eb',
  none: '#64748b',
};

function formatLabel(value) {
  if (!value) {
    return 'N/A';
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRadius(value) {
  if (value === 0) {
    return '0 m';
  }

  return value ? `${value} m` : 'N/A';
}

function isValidCssColor(value) {
  if (!value || typeof value !== 'string' || typeof CSS === 'undefined' || !CSS.supports) {
    return false;
  }

  return CSS.supports('color', value);
}

function resolveColor(profile) {
  if (isValidCssColor(profile?.map_color)) {
    return profile.map_color;
  }

  return (
    ZONE_FALLBACK_COLORS[profile?.zone_type]
    || RISK_FALLBACK_COLORS[profile?.risk_level]
    || ZONE_FALLBACK_COLORS.none
  );
}

function getRadiusValue(profile) {
  const radius = Number(profile?.spread_radius_m);
  return Number.isFinite(radius) && radius >= 0 ? radius : 0;
}

function scaleBubbleSize(radius, maxRadius) {
  if (radius <= 0 || maxRadius <= 0) {
    return 26;
  }

  const normalized = radius / maxRadius;
  return Math.round(26 + normalized * 54);
}

function groupDiseases(diseases) {
  return diseases.reduce(
    (groups, disease) => {
      const organType = disease.organ_type || 'other';
      if (!groups[organType]) {
        groups[organType] = [];
      }
      groups[organType].push(disease);
      return groups;
    },
    { fruit: [], leaf: [] },
  );
}

function BubblePreview({ disease, maxRadius }) {
  const profile = disease.map_profile;
  const radius = getRadiusValue(profile);
  const size = scaleBubbleSize(radius, maxRadius);
  const color = resolveColor(profile);
  const isNoZone = !profile || profile.zone_type === 'none' || radius === 0;

  return (
    <div className="relative flex h-24 items-center justify-center">
      <div
        className="rounded-full border transition-transform duration-200 group-hover:scale-105"
        style={{
          width: size,
          height: size,
          borderColor: color,
          backgroundColor: isNoZone ? `${color}14` : `${color}22`,
          boxShadow: isNoZone ? 'none' : `0 0 0 10px ${color}12`,
          opacity: isNoZone ? 0.75 : 1,
          borderStyle: isNoZone ? 'dashed' : 'solid',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 10,
          height: 10,
          backgroundColor: color,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

function DiseaseBubbleCard({ disease, maxRadius, onSelectDisease, isLightMode }) {
  const profile = disease.map_profile;
  const radius = getRadiusValue(profile);
  const zoneType = profile?.zone_type || 'none';
  const riskLevel = profile?.risk_level || 'low';
  const infectiousLabel = profile
    ? (profile.is_infectious ? 'Infectious' : 'Non-infectious')
    : 'No profile';
  const transmissionMode = profile?.transmission_mode || '';
  const hasProfile = Boolean(profile);

  return (
    <button
      type="button"
      onClick={() => onSelectDisease(disease)}
      className={cn(
        'group flex h-full w-full flex-col rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isLightMode
          ? 'border-slate-200 bg-white/84 shadow-[0_10px_24px_rgba(15,23,42,0.04)] hover:border-emerald-300 hover:bg-white'
          : 'border-border bg-card/70 hover:border-primary/40 hover:bg-card',
      )}
    >
      <BubblePreview disease={disease} maxRadius={maxRadius} />

      <div className="space-y-2">
        <div className="space-y-1">
          <div className="line-clamp-1 text-sm font-semibold text-foreground">
            {disease.name}
          </div>
          <div className="line-clamp-1 font-mono text-xs text-muted-foreground">
            {disease.ai_label || 'No AI label'}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="bg-background font-medium">
            {formatLabel(disease.organ_type)}
          </Badge>
          <Badge variant="outline" className="bg-background font-medium">
            {formatLabel(riskLevel)}
          </Badge>
          <Badge variant="outline" className="bg-background font-medium">
            {formatLabel(zoneType)}
          </Badge>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div>{infectiousLabel}</div>
          <div>Radius {formatRadius(radius)}</div>
          <div className="line-clamp-1">
            {hasProfile
              ? `${formatLabel(profile.spread_category)} / ${formatLabel(transmissionMode)}`
              : 'No map profile configured'}
          </div>
        </div>
      </div>
    </button>
  );
}

function SpreadMapSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-52" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-52 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function CatalogDiseaseSpreadMap({
  diseases = [],
  isLoading,
  isError,
  onSelectDisease,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const groupedDiseases = useMemo(() => groupDiseases(diseases), [diseases]);
  const summary = useMemo(() => {
    const profiledCount = diseases.filter((disease) => disease.map_profile).length;
    const noZoneCount = diseases.filter((disease) => {
      const profile = disease.map_profile;
      return !profile || profile.zone_type === 'none' || getRadiusValue(profile) === 0;
    }).length;

    return {
      total: diseases.length,
      profiledCount,
      noZoneCount,
    };
  }, [diseases]);
  const maxRadius = useMemo(
    () => diseases.reduce((maxValue, disease) => Math.max(maxValue, getRadiusValue(disease.map_profile)), 0),
    [diseases],
  );

  return (
    <PanelCard
      title="Disease spread map"
      subtitle="Compact non-GPS profile view based on catalog disease map metadata."
      badge={`${summary.profiledCount}/${summary.total} profiled`}
    >
      {isLoading ? <SpreadMapSkeleton /> : null}

      {!isLoading && isError ? (
        <StateBlock
          title="Spread map unavailable"
          message="The catalog disease spread map could not be loaded."
          minHeight={180}
        />
      ) : null}

      {!isLoading && !isError && diseases.length === 0 ? (
        <StateBlock
          title="No diseases found"
          message="No disease records are available for the spread map."
          minHeight={180}
        />
      ) : null}

      {!isLoading && !isError && diseases.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn('font-medium', isLightMode ? 'border-slate-200 bg-white/90 text-slate-700' : 'bg-background')}>
              {summary.total} diseases
            </Badge>
            <Badge variant="outline" className={cn('font-medium', isLightMode ? 'border-slate-200 bg-white/90 text-slate-700' : 'bg-background')}>
              {summary.noZoneCount} no zone
            </Badge>
            <Badge variant="outline" className={cn('font-medium', isLightMode ? 'border-slate-200 bg-white/90 text-slate-700' : 'bg-background')}>
              Bubble size uses spread radius
            </Badge>
          </div>

          <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
            {Object.entries(groupedDiseases)
              .filter(([, organDiseases]) => organDiseases.length > 0)
              .map(([organType, organDiseases]) => (
                <div key={organType} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">
                      {ORGAN_LABELS[organType] || formatLabel(organType)}
                    </div>
                    <Badge variant="outline" className={cn('font-medium', isLightMode ? 'border-slate-200 bg-white/90 text-slate-700' : 'bg-background')}>
                      {organDiseases.length} disease{organDiseases.length === 1 ? '' : 's'}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {organDiseases.map((disease) => (
                      <DiseaseBubbleCard
                        key={disease.id}
                        disease={disease}
                        maxRadius={maxRadius}
                        onSelectDisease={onSelectDisease}
                        isLightMode={isLightMode}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </PanelCard>
  );
}
