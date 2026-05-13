import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  Portal,
  Stack,
  Typography,
} from '@mui/material';
import BiotechRoundedIcon from '@mui/icons-material/BiotechRounded';
import FmdBadRoundedIcon from '@mui/icons-material/FmdBadRounded';
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import DrawerCloseButton from '@/components/ui/DrawerCloseButton';
import { useThemeMode } from '@/theme-mode-context';

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function formatValue(value) {
  return hasValue(value) ? value : 'N/A';
}

function formatLabel(value) {
  if (!hasValue(value)) {
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

  if (!hasValue(value)) {
    return 'N/A';
  }

  return `${value} m`;
}

function DetailRow({ label, value, isLightMode }) {
  return (
    <Stack spacing={0.35}>
      <Typography
        variant="caption"
        sx={{
          color: isLightMode ? '#64748b' : 'rgba(148, 163, 184, 0.92)',
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: isLightMode ? '#0f172a' : 'rgba(241, 245, 249, 0.96)',
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap',
        }}
      >
        {formatValue(value)}
      </Typography>
    </Stack>
  );
}

function SectionCard({ icon, title, subtitle, children, isLightMode }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1.5,
        bgcolor: isLightMode ? 'rgba(255,255,255,0.82)' : 'rgba(255, 255, 255, 0.04)',
        borderColor: isLightMode ? 'rgba(203, 213, 225, 0.92)' : 'rgba(255, 255, 255, 0.1)',
        boxShadow: isLightMode ? '0 10px 24px rgba(15,23,42,0.04)' : 'none',
      }}
    >
      <CardContent sx={{ p: 1.35, '&:last-child': { pb: 1.35 } }}>
        <Stack spacing={1.15}>
          <Stack spacing={0.35}>
            <Stack direction="row" spacing={0.85} alignItems="center">
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: 1,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: isLightMode ? 'rgba(220,252,231,0.86)' : 'rgba(16, 185, 129, 0.12)',
                  color: isLightMode ? '#166534' : '#9AF0C1',
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
              <Typography variant="subtitle2" sx={{ color: isLightMode ? '#0f172a' : '#F8FAFC', fontWeight: 800 }}>
                {title}
              </Typography>
            </Stack>
            {subtitle ? (
              <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
                {subtitle}
              </Typography>
            ) : null}
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ListSection({ title, items, emptyMessage, renderItem, isLightMode }) {
  return (
    <Stack spacing={1.05}>
      <Typography variant="subtitle2" sx={{ color: isLightMode ? '#0f172a' : '#F8FAFC', fontWeight: 700 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
          {emptyMessage}
        </Typography>
      ) : (
        <Stack spacing={0.9}>
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                borderRadius: 1.25,
                border: isLightMode ? '1px solid rgba(203,213,225,0.92)' : '1px solid rgba(148, 163, 184, 0.12)',
                bgcolor: isLightMode ? 'rgba(255,255,255,0.76)' : 'rgba(255, 255, 255, 0.03)',
                px: 1.15,
                py: 1,
              }}
            >
              {renderItem(item)}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default function CatalogDiseaseDetailDrawer({
  open,
  onClose,
  disease,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const profile = disease?.map_profile;
  const causes = disease?.causes ?? [];
  const treatments = disease?.treatments ?? [];
  const resources = disease?.resources ?? [];

  return (
    <Portal>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: (theme) => theme.zIndex.drawer,
          pointerEvents: open ? 'auto' : 'none',
          visibility: open ? 'visible' : 'hidden',
        }}
      >
        <Box
          onClick={onClose}
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: isLightMode ? 'rgba(15,23,42,0.12)' : 'rgba(2, 6, 23, 0.18)',
          }}
        />

        <Box
          role="dialog"
          aria-modal="false"
          aria-label="Disease details"
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 'min(520px, calc(100vw - 16px))',
            minWidth: 'min(520px, calc(100vw - 16px))',
            maxWidth: 'min(520px, calc(100vw - 16px))',
            height: '100dvh',
            minHeight: '100dvh',
            maxHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: isLightMode ? '#f8fbf8' : '#07110F',
            borderLeft: isLightMode ? '1px solid rgba(203,213,225,0.95)' : '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: isLightMode ? '0 18px 44px rgba(15,23,42,0.16)' : '0 20px 54px rgba(0, 0, 0, 0.34)',
            overflow: 'hidden',
            pointerEvents: 'auto',
            transform: open ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 220ms ease',
            willChange: 'transform',
          }}
        >
          <Box
            sx={{
              px: { xs: 1.5, sm: 1.75 },
              py: { xs: 1.15, sm: 1.35 },
              background: isLightMode
                ? 'linear-gradient(160deg, rgba(220,252,231,0.88), rgba(255,255,255,0.98))'
                : 'linear-gradient(160deg, rgba(21, 128, 61, 0.2), rgba(6, 15, 13, 0.98))',
              borderBottom: isLightMode ? '1px solid rgba(226,232,240,0.92)' : '1px solid rgba(148, 163, 184, 0.16)',
              flexShrink: 0,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: isLightMode ? '#166534' : '#86EFAC', lineHeight: 1.1, letterSpacing: 1.4 }}
                  >
                    Disease details
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: isLightMode ? '#0f172a' : '#F8FAFC',
                      fontWeight: 850,
                      letterSpacing: '-0.03em',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {disease?.name || 'Selected disease'}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.78)', overflowWrap: 'anywhere' }}
                  >
                    {disease?.ai_label || 'No AI label'}
                  </Typography>
                </Stack>
                <DrawerCloseButton
                  onClick={onClose}
                  aria-label="Close disease details"
                />
              </Stack>

              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip
                  size="small"
                  label={`Organ ${formatLabel(disease?.organ_type)}`}
                  sx={isLightMode
                    ? { borderColor: 'rgba(34,197,94,0.22)', bgcolor: 'rgba(220,252,231,0.78)', color: '#166534' }
                    : { borderColor: 'rgba(134, 239, 172, 0.32)', color: '#BBF7D0' }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Slug ${disease?.slug || 'N/A'}`}
                  sx={isLightMode
                    ? { borderColor: 'rgba(203,213,225,0.95)', bgcolor: 'rgba(255,255,255,0.82)', color: '#475569' }
                    : { borderColor: 'rgba(148, 163, 184, 0.28)', color: '#CBD5E1' }}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              p: { xs: 1.25, sm: 1.5 },
              bgcolor: isLightMode ? '#f1f6f2' : '#050A09',
            }}
          >
            <Stack spacing={1.25}>
              <SectionCard
                icon={<BiotechRoundedIcon fontSize="small" />}
                title="Disease"
                subtitle="Core catalog identity and descriptive fields."
                isLightMode={isLightMode}
              >
                <Stack spacing={1.05}>
                  <DetailRow label="Name" value={disease?.name} isLightMode={isLightMode} />
                  <DetailRow label="Slug" value={disease?.slug} isLightMode={isLightMode} />
                  <DetailRow label="Organ type" value={formatLabel(disease?.organ_type)} isLightMode={isLightMode} />
                  <DetailRow label="AI label" value={disease?.ai_label} isLightMode={isLightMode} />
                  <DetailRow label="Summary" value={disease?.summary} isLightMode={isLightMode} />
                  <DetailRow label="Symptoms" value={disease?.symptoms} isLightMode={isLightMode} />
                  <DetailRow label="Prevention" value={disease?.prevention} isLightMode={isLightMode} />
                </Stack>
              </SectionCard>

              <SectionCard
                icon={<FmdBadRoundedIcon fontSize="small" />}
                title="Map Profile"
                subtitle="Database-backed disease spread and risk metadata."
                isLightMode={isLightMode}
              >
                {profile ? (
                  <Stack spacing={1.05}>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      <Chip
                        size="small"
                        label={profile.is_infectious ? 'Infectious' : 'Non-infectious'}
                        sx={isLightMode
                          ? {
                              borderColor: profile.is_infectious
                                ? 'rgba(248, 113, 113, 0.22)'
                                : 'rgba(34, 197, 94, 0.22)',
                              bgcolor: profile.is_infectious ? 'rgba(254,242,242,0.9)' : 'rgba(220,252,231,0.78)',
                              color: profile.is_infectious ? '#b91c1c' : '#166534',
                            }
                          : {
                              borderColor: profile.is_infectious
                                ? 'rgba(248, 113, 113, 0.32)'
                                : 'rgba(134, 239, 172, 0.32)',
                              color: profile.is_infectious ? '#FECACA' : '#BBF7D0',
                            }}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={formatLabel(profile.risk_level)}
                        sx={isLightMode
                          ? { borderColor: 'rgba(203,213,225,0.95)', bgcolor: 'rgba(255,255,255,0.82)', color: '#475569' }
                          : { borderColor: 'rgba(148, 163, 184, 0.28)', color: '#CBD5E1' }}
                        variant="outlined"
                      />
                    </Stack>
                    <DetailRow label="Zone type" value={formatLabel(profile.zone_type)} isLightMode={isLightMode} />
                    <DetailRow label="Spread radius" value={formatRadius(profile.spread_radius_m)} isLightMode={isLightMode} />
                    <DetailRow label="Spread category" value={formatLabel(profile.spread_category)} isLightMode={isLightMode} />
                    <DetailRow label="Transmission mode" value={formatLabel(profile.transmission_mode)} isLightMode={isLightMode} />
                    <DetailRow label="Map label" value={profile.map_label} isLightMode={isLightMode} />
                    <DetailRow label="Short map description" value={profile.short_map_description} isLightMode={isLightMode} />
                    <DetailRow label="Source notes" value={profile.source_notes} isLightMode={isLightMode} />
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
                    No map profile configured.
                  </Typography>
                )}
              </SectionCard>

              <SectionCard
                icon={<BiotechRoundedIcon fontSize="small" />}
                title="Causes"
                subtitle="Nested cause records returned from the catalog API."
                isLightMode={isLightMode}
              >
                <ListSection
                  title="Causes"
                  items={causes}
                  emptyMessage="No causes returned by the backend."
                  isLightMode={isLightMode}
                  renderItem={(cause) => (
                    <Stack spacing={0.45}>
                      <Typography variant="body2" sx={{ color: isLightMode ? '#0f172a' : '#F8FAFC', fontWeight: 700 }}>
                        {cause.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
                        {cause.description || 'No description'}
                      </Typography>
                    </Stack>
                  )}
                />
              </SectionCard>

              <SectionCard
                icon={<HealingRoundedIcon fontSize="small" />}
                title="Treatments"
                subtitle="Suggested interventions recorded in the catalog."
                isLightMode={isLightMode}
              >
                <ListSection
                  title="Treatments"
                  items={treatments}
                  emptyMessage="No treatments returned by the backend."
                  isLightMode={isLightMode}
                  renderItem={(treatment) => (
                    <Stack spacing={0.45}>
                      <Typography variant="body2" sx={{ color: isLightMode ? '#0f172a' : '#F8FAFC', fontWeight: 700 }}>
                        {treatment.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
                        {treatment.description || 'No description'}
                      </Typography>
                    </Stack>
                  )}
                />
              </SectionCard>

              <SectionCard
                icon={<LinkRoundedIcon fontSize="small" />}
                title="Resources"
                subtitle="Linked reference material returned by the backend."
                isLightMode={isLightMode}
              >
                <ListSection
                  title="Resources"
                  items={resources}
                  emptyMessage="No resources returned by the backend."
                  isLightMode={isLightMode}
                  renderItem={(resource) => (
                    <Stack spacing={0.45}>
                      <Typography variant="body2" sx={{ color: isLightMode ? '#0f172a' : '#F8FAFC', fontWeight: 700 }}>
                        {resource.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
                        {resource.description || 'No description'}
                      </Typography>
                      {resource.url ? (
                        <Link
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          underline="hover"
                          sx={{ color: isLightMode ? '#2563eb' : '#93C5FD', overflowWrap: 'anywhere' }}
                        >
                          {resource.url}
                        </Link>
                      ) : (
                        <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
                          N/A
                        </Typography>
                      )}
                    </Stack>
                  )}
                />
              </SectionCard>

              <Divider sx={{ borderColor: isLightMode ? 'rgba(226,232,240,0.92)' : 'rgba(148, 163, 184, 0.14)' }} />
            </Stack>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
