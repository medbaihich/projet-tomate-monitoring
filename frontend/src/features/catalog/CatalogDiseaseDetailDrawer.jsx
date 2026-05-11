import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Link,
  Portal,
  Stack,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import BiotechRoundedIcon from '@mui/icons-material/BiotechRounded';
import FmdBadRoundedIcon from '@mui/icons-material/FmdBadRounded';
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';

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

function DetailRow({ label, value }) {
  return (
    <Stack spacing={0.35}>
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(148, 163, 184, 0.92)',
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'rgba(241, 245, 249, 0.96)',
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap',
        }}
      >
        {formatValue(value)}
      </Typography>
    </Stack>
  );
}

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1.5,
        bgcolor: 'rgba(255, 255, 255, 0.04)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
                  bgcolor: 'rgba(16, 185, 129, 0.12)',
                  color: '#9AF0C1',
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
              <Typography variant="subtitle2" sx={{ color: '#F8FAFC', fontWeight: 800 }}>
                {title}
              </Typography>
            </Stack>
            {subtitle ? (
              <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
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

function ListSection({ title, items, emptyMessage, renderItem }) {
  return (
    <Stack spacing={1.05}>
      <Typography variant="subtitle2" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
          {emptyMessage}
        </Typography>
      ) : (
        <Stack spacing={0.9}>
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                borderRadius: 1.25,
                border: '1px solid rgba(148, 163, 184, 0.12)',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
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
            bgcolor: 'rgba(2, 6, 23, 0.18)',
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
            bgcolor: '#07110F',
            borderLeft: '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: '0 20px 54px rgba(0, 0, 0, 0.34)',
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
              background: 'linear-gradient(160deg, rgba(21, 128, 61, 0.2), rgba(6, 15, 13, 0.98))',
              borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
              flexShrink: 0,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: '#86EFAC', lineHeight: 1.1, letterSpacing: 1.4 }}
                  >
                    Disease details
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: '#F8FAFC',
                      fontWeight: 850,
                      letterSpacing: '-0.03em',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {disease?.name || 'Selected disease'}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'rgba(203, 213, 225, 0.78)', overflowWrap: 'anywhere' }}
                  >
                    {disease?.ai_label || 'No AI label'}
                  </Typography>
                </Stack>
                <IconButton
                  onClick={onClose}
                  aria-label="Close disease details"
                  sx={{
                    color: '#E2E8F0',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.08)',
                    },
                  }}
                >
                  <CloseRoundedIcon />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip
                  size="small"
                  label={`Organ ${formatLabel(disease?.organ_type)}`}
                  sx={{ borderColor: 'rgba(134, 239, 172, 0.32)', color: '#BBF7D0' }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Slug ${disease?.slug || 'N/A'}`}
                  sx={{ borderColor: 'rgba(148, 163, 184, 0.28)', color: '#CBD5E1' }}
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
              bgcolor: '#050A09',
            }}
          >
            <Stack spacing={1.25}>
              <SectionCard
                icon={<BiotechRoundedIcon fontSize="small" />}
                title="Disease"
                subtitle="Core catalog identity and descriptive fields."
              >
                <Stack spacing={1.05}>
                  <DetailRow label="Name" value={disease?.name} />
                  <DetailRow label="Slug" value={disease?.slug} />
                  <DetailRow label="Organ type" value={formatLabel(disease?.organ_type)} />
                  <DetailRow label="AI label" value={disease?.ai_label} />
                  <DetailRow label="Summary" value={disease?.summary} />
                  <DetailRow label="Symptoms" value={disease?.symptoms} />
                  <DetailRow label="Prevention" value={disease?.prevention} />
                </Stack>
              </SectionCard>

              <SectionCard
                icon={<FmdBadRoundedIcon fontSize="small" />}
                title="Map Profile"
                subtitle="Database-backed disease spread and risk metadata."
              >
                {profile ? (
                  <Stack spacing={1.05}>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      <Chip
                        size="small"
                        label={profile.is_infectious ? 'Infectious' : 'Non-infectious'}
                        sx={{
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
                        sx={{ borderColor: 'rgba(148, 163, 184, 0.28)', color: '#CBD5E1' }}
                        variant="outlined"
                      />
                    </Stack>
                    <DetailRow label="Zone type" value={formatLabel(profile.zone_type)} />
                    <DetailRow label="Spread radius" value={formatRadius(profile.spread_radius_m)} />
                    <DetailRow label="Spread category" value={formatLabel(profile.spread_category)} />
                    <DetailRow label="Transmission mode" value={formatLabel(profile.transmission_mode)} />
                    <DetailRow label="Map label" value={profile.map_label} />
                    <DetailRow label="Short map description" value={profile.short_map_description} />
                    <DetailRow label="Source notes" value={profile.source_notes} />
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
                    No map profile configured.
                  </Typography>
                )}
              </SectionCard>

              <SectionCard
                icon={<BiotechRoundedIcon fontSize="small" />}
                title="Causes"
                subtitle="Nested cause records returned from the catalog API."
              >
                <ListSection
                  title="Causes"
                  items={causes}
                  emptyMessage="No causes returned by the backend."
                  renderItem={(cause) => (
                    <Stack spacing={0.45}>
                      <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
                        {cause.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
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
              >
                <ListSection
                  title="Treatments"
                  items={treatments}
                  emptyMessage="No treatments returned by the backend."
                  renderItem={(treatment) => (
                    <Stack spacing={0.45}>
                      <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
                        {treatment.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
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
              >
                <ListSection
                  title="Resources"
                  items={resources}
                  emptyMessage="No resources returned by the backend."
                  renderItem={(resource) => (
                    <Stack spacing={0.45}>
                      <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
                        {resource.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
                        {resource.description || 'No description'}
                      </Typography>
                      {resource.url ? (
                        <Link
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          underline="hover"
                          sx={{ color: '#93C5FD', overflowWrap: 'anywhere' }}
                        >
                          {resource.url}
                        </Link>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
                          N/A
                        </Typography>
                      )}
                    </Stack>
                  )}
                />
              </SectionCard>

              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.14)' }} />
            </Stack>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
