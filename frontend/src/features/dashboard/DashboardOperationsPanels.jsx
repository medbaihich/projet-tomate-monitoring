import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RuleFolderOutlinedIcon from '@mui/icons-material/RuleFolderOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import StateBlock from '@/components/ui/StateBlock';
import StatusChip from '@/components/ui/StatusChip';
import { formatConfidencePercentage } from '@/features/dashboard/utils';

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString();
}

function resolveDiseaseName(diseaseId, diseaseMap) {
  if (!diseaseId) {
    return 'N/A';
  }

  return diseaseMap.get(diseaseId)?.name || diseaseId;
}

function resolveDeviceLabel(deviceId, deviceMap) {
  if (!deviceId) {
    return 'N/A';
  }

  const device = deviceMap.get(deviceId);
  if (!device) {
    return deviceId;
  }

  return `${device.name} (${device.identifier})`;
}

export function RecentInspectionsTable({ inspections, deviceMap, diseaseMap }) {
  if (!inspections.length) {
    return <StateBlock title="No recent inspections" message="No recent inspections available." />;
  }

  return (
    <TableContainer
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.default',
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Captured</TableCell>
            <TableCell>Device</TableCell>
            <TableCell>Prediction</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Confidence</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {inspections.map((inspection) => (
            <TableRow key={inspection.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(inspection.captured_at)}</TableCell>
              <TableCell>{resolveDeviceLabel(inspection.device, deviceMap)}</TableCell>
              <TableCell>
                <Stack spacing={0.5}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {inspection.top1_label || resolveDiseaseName(inspection.predicted_disease, diseaseMap)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Organ: {inspection.organ_type || 'N/A'}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                  <StatusChip
                    label={inspection.status}
                    tone={inspection.status === 'new' ? 'new' : inspection.status === 'reviewed' ? 'reviewed' : 'neutral'}
                  />
                  <StatusChip
                    label={inspection.processing_status}
                    tone={inspection.processing_status === 'failed' ? 'failed' : inspection.processing_status === 'completed' ? 'completed' : inspection.processing_status === 'processing' ? 'processing' : 'pending'}
                  />
                </Stack>
              </TableCell>
              <TableCell align="right">{formatConfidencePercentage(inspection.confidence_score)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function PendingReviewQueue({ inspections, deviceMap, diseaseMap }) {
  if (!inspections.length) {
    return (
        <StateBlock
          title="No low-confidence review items"
          message="No recent inspections currently meet the low-confidence review rule."
        />
      );
  }

  return (
    <Stack spacing={1}>
      {inspections.map((inspection) => (
        <Card
          key={inspection.id}
          variant="outlined"
          sx={{
            bgcolor: 'background.default',
            borderRadius: 1.5,
          }}
        >
          <CardContent sx={{ py: 1.1 }}>
            <Stack spacing={0.75}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {inspection.top1_label || resolveDiseaseName(inspection.predicted_disease, diseaseMap)}
                </Typography>
                <StatusChip size="small" tone="review" label={inspection.organ_type || 'N/A'} />
              </Stack>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <StatusChip size="small" tone={inspection.status === 'new' ? 'new' : 'neutral'} label={inspection.status} />
                <StatusChip
                  size="small"
                  tone={inspection.processing_status === 'failed' ? 'failed' : inspection.processing_status === 'completed' ? 'completed' : 'pending'}
                  label={inspection.processing_status}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {resolveDeviceLabel(inspection.device, deviceMap)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Captured {formatDateTime(inspection.captured_at)}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
      <Button component={RouterLink} to="/review" variant="outlined" endIcon={<ArrowForwardRoundedIcon />}>
        Open Review Workspace
      </Button>
    </Stack>
  );
}

export function OperationalHighlights({ highlights }) {
  return (
    <Stack spacing={1}>
      {highlights.map((highlight, index) => (
        <Alert
          key={`${highlight.title}-${index}`}
          severity={highlight.tone}
          variant="standard"
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {highlight.title}
          </Typography>
          <Typography variant="body2">{highlight.message}</Typography>
        </Alert>
      ))}
    </Stack>
  );
}

export function QuickActionsPanel() {
  const actions = [
    {
      title: 'Devices',
      description: 'Inspect the live site, greenhouse, zone, and device hierarchy.',
      href: '/devices',
      icon: <Inventory2OutlinedIcon fontSize="small" />,
    },
    {
      title: 'Review Workspace',
      description: 'Process pending inspections and submit review decisions.',
      href: '/review',
      icon: <ScienceOutlinedIcon fontSize="small" />,
    },
    {
      title: 'Catalog',
      description: 'Browse diseases, treatments, causes, and resource references.',
      href: '/catalog',
      icon: <RuleFolderOutlinedIcon fontSize="small" />,
    },
  ];

  return (
    <Stack spacing={1}>
      {actions.map((action) => (
        <Card
          key={action.href}
          variant="outlined"
          sx={{
            bgcolor: 'background.default',
            borderRadius: 1.5,
          }}
        >
          <CardActionArea component={RouterLink} to={action.href}>
            <CardContent>
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'rgba(31, 106, 61, 0.08)',
                      color: 'primary.dark',
                    }}
                  >
                    {action.icon}
                  </Box>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {action.title}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {action.description}
                </Typography>
                <Link component="span" underline="hover">
                  Open {action.title}
                </Link>
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
      <Button component={RouterLink} to="/review" variant="contained" endIcon={<ArrowForwardRoundedIcon />}>
        Go To Active Review Queue
      </Button>
    </Stack>
  );
}
