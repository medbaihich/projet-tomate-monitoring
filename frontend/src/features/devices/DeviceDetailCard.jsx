import {
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import PanelCard from '@/components/ui/PanelCard';
import StateBlock from '@/components/ui/StateBlock';

function DetailRow({ label, value }) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="body2">
        {value || 'N/A'}
      </Typography>
    </Stack>
  );
}

function resolveHierarchyValue(primaryValue, fallbackValue) {
  return primaryValue || fallbackValue || 'N/A';
}

export default function DeviceDetailCard({ device, hierarchyPath }) {
  if (!device) {
    return (
      <PanelCard minHeight={220}>
        <StateBlock
          title="Select a device"
          message="Select a device row from the registry to view its backend fields."
          minHeight={170}
        />
      </PanelCard>
    );
  }

  return (
    <PanelCard
      title="Device details"
      subtitle="Backend fields for the selected registry row."
      badge={device.identifier}
    >
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {device.name}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip size="small" label={`ID ${device.id}`} />
            <Chip size="small" color="primary" variant="outlined" label={`Line ${device.line_name || device.line}`} />
            <Chip size="small" variant="outlined" label={`Zone ${device.zone_name || device.zone}`} />
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={1.1}>
          <DetailRow label="device" value={device.name} />
          <DetailRow label="identifier" value={device.identifier} />
          <DetailRow label="site" value={resolveHierarchyValue(hierarchyPath?.siteName, device.site_name)} />
          <DetailRow label="greenhouse" value={resolveHierarchyValue(hierarchyPath?.greenhouseName, device.greenhouse_name)} />
          <DetailRow label="zone" value={resolveHierarchyValue(hierarchyPath?.zoneName, device.zone_name)} />
          <DetailRow label="line" value={resolveHierarchyValue(hierarchyPath?.lineName, device.line_name)} />
          <DetailRow label="description" value={device.description} />
          <DetailRow label="created_at" value={device.created_at} />
          <DetailRow label="updated_at" value={device.updated_at} />
        </Stack>

        <Divider />

        <Stack spacing={0.75}>
          <Typography variant="subtitle2" color="text.secondary">
            References
          </Typography>
          <Stack spacing={1.1}>
            <DetailRow label="id" value={device.id} />
            <DetailRow label="site_id" value={device.site} />
            <DetailRow label="greenhouse_id" value={device.greenhouse} />
            <DetailRow label="zone_id" value={device.zone} />
            <DetailRow label="line_id" value={device.line} />
          </Stack>
        </Stack>
      </Stack>
    </PanelCard>
  );
}
