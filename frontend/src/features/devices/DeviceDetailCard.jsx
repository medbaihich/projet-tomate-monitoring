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

export default function DeviceDetailCard({ device, hierarchyPath }) {
  if (!device) {
    return (
      <PanelCard minHeight={220}>
        <StateBlock
          title="Select a device"
          message="Choose a device node from the hierarchy to view its real backend fields."
          minHeight={170}
        />
      </PanelCard>
    );
  }

  return (
    <PanelCard
      title="Device details"
      subtitle="Resolved backend fields for the selected operational device."
      badge={device.identifier}
    >
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {device.name}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip size="small" label={`ID ${device.id}`} />
            <Chip size="small" color="primary" variant="outlined" label={`Zone ${device.zone}`} />
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={1.1}>
          <DetailRow label="id" value={device.id} />
          <DetailRow label="zone" value={device.zone} />
          <DetailRow label="name" value={device.name} />
          <DetailRow label="identifier" value={device.identifier} />
          <DetailRow label="description" value={device.description} />
          <DetailRow label="created_at" value={device.created_at} />
          <DetailRow label="updated_at" value={device.updated_at} />
        </Stack>

        <Divider />

        <Stack spacing={0.75}>
          <Typography variant="subtitle2" color="text.secondary">
            Hierarchy path
          </Typography>
          <Typography variant="body2">
            {hierarchyPath.siteName} / {hierarchyPath.greenhouseName} / {hierarchyPath.zoneName}
          </Typography>
        </Stack>
      </Stack>
    </PanelCard>
  );
}
