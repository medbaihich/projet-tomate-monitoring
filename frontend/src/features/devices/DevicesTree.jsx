import { memo, useMemo } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import {
  Apartment as SiteIcon,
  DeviceHub as GreenhouseIcon,
  Hub as ZoneIcon,
  Memory as DeviceIcon,
} from '@mui/icons-material';

const NodeLabel = memo(function NodeLabel({ icon, title, meta }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.35 }}>
      {icon}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.84rem' }}>
          {title}
        </Typography>
        {meta ? (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
            {meta}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
});

function renderDeviceNode(device, path, onSelectDevice) {
  const itemId = `device:${device.id}`;

  return (
    <TreeItem
      key={itemId}
      itemId={itemId}
      onClick={() => onSelectDevice(device, path)}
      label={(
        <NodeLabel
          icon={<DeviceIcon fontSize="small" sx={{ color: 'primary.dark' }} />}
          title={device.name}
          meta={device.identifier}
        />
      )}
    />
  );
}

function renderZoneNode(zone, path, onSelectDevice) {
  const itemId = `zone:${zone.id}`;

  return (
    <TreeItem
      key={itemId}
      itemId={itemId}
      label={(
        <NodeLabel
          icon={<ZoneIcon fontSize="small" sx={{ color: 'secondary.main' }} />}
          title={zone.name}
          meta={`${zone.devices.length} device${zone.devices.length === 1 ? '' : 's'}`}
        />
      )}
    >
      {zone.devices.map((device) => renderDeviceNode(device, { ...path, zoneName: zone.name }, onSelectDevice))}
    </TreeItem>
  );
}

function renderGreenhouseNode(greenhouse, path, onSelectDevice) {
  const itemId = `greenhouse:${greenhouse.id}`;

  return (
    <TreeItem
      key={itemId}
      itemId={itemId}
      label={(
        <NodeLabel
          icon={<GreenhouseIcon fontSize="small" sx={{ color: 'success.main' }} />}
          title={greenhouse.name}
          meta={`${greenhouse.zones.length} zone${greenhouse.zones.length === 1 ? '' : 's'}`}
        />
      )}
    >
      {greenhouse.zones.map((zone) => renderZoneNode(zone, { ...path, greenhouseName: greenhouse.name }, onSelectDevice))}
    </TreeItem>
  );
}

function renderSiteNode(site, onSelectDevice) {
  const itemId = `site:${site.id}`;

  return (
    <TreeItem
      key={itemId}
      itemId={itemId}
      label={(
        <NodeLabel
          icon={<SiteIcon fontSize="small" sx={{ color: 'primary.main' }} />}
          title={site.name}
          meta={site.location}
        />
      )}
    >
      {site.greenhouses.map((greenhouse) =>
        renderGreenhouseNode(greenhouse, { siteName: site.name, greenhouseName: '', zoneName: '' }, onSelectDevice),
      )}
    </TreeItem>
  );
}

function DevicesTree({
  sites,
  selectedItemId,
  expandedItems,
  onExpandedItemsChange,
  onSelectedItemsChange,
  onSelectDevice,
}) {
  const treeItems = useMemo(
    () => sites.map((site) => renderSiteNode(site, onSelectDevice)),
    [sites, onSelectDevice],
  );

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip size="small" label={`${sites.length} site${sites.length === 1 ? '' : 's'}`} />
      </Stack>

      <SimpleTreeView
        selectedItems={selectedItemId ? [selectedItemId] : []}
        expandedItems={expandedItems}
        onExpandedItemsChange={onExpandedItemsChange}
        onSelectedItemsChange={onSelectedItemsChange}
        sx={{
          overflowX: 'auto',
          minHeight: 236,
          p: 0.5,
          borderRadius: 1.25,
          bgcolor: 'background.default',
          '& .MuiTreeItem-content': {
            borderRadius: 1,
            py: 0.12,
            px: 0.3,
            '&:hover': {
              bgcolor: 'rgba(31, 106, 61, 0.06)',
            },
          },
          '& .MuiTreeItem-content.Mui-selected': {
            bgcolor: 'rgba(31, 106, 61, 0.12)',
          },
        }}
      >
        {treeItems}
      </SimpleTreeView>
    </Stack>
  );
}

export default memo(DevicesTree);
