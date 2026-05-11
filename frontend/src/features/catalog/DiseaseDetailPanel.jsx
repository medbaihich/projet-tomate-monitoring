import {
  Box,
  Chip,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import PanelCard from '@/components/ui/PanelCard';
import StateBlock from '@/components/ui/StateBlock';
import DiseaseMapProfilePanel from '@/features/catalog/DiseaseMapProfilePanel';

function ValueBlock({ label, value }) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2">
        {value || 'N/A'}
      </Typography>
    </Stack>
  );
}

function NestedSection({ title, items, renderItem }) {
  return (
    <Stack spacing={0.75}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No {title.toLowerCase()} returned by the backend.
        </Typography>
      ) : (
        <List disablePadding>
          {items.map((item) => (
            <ListItem key={item.id} disableGutters sx={{ py: 0.75, alignItems: 'flex-start' }}>
              {renderItem(item)}
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  );
}

export default function DiseaseDetailPanel({ disease }) {
  if (!disease) {
    return (
      <PanelCard minHeight={300}>
        <StateBlock
          title="Select a disease"
          message="Pick a row from the catalog grid to view its real disease fields, causes, treatments, and resources."
          minHeight={190}
        />
      </PanelCard>
    );
  }

  return (
    <PanelCard
      title="Disease details"
      subtitle="Reference data returned from the disease catalog."
      badge={`ID ${disease.id}`}
    >
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {disease.name}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip size="small" color="primary" label={`Organ ${disease.organ_type || 'N/A'}`} />
            <Chip size="small" variant="outlined" label={`AI ${disease.ai_label || 'N/A'}`} />
            <Chip size="small" label={`Slug ${disease.slug}`} />
            <Chip size="small" variant="outlined" label={`${disease.causes.length} cause${disease.causes.length === 1 ? '' : 's'}`} />
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={1.1}>
          <ValueBlock label="summary" value={disease.summary} />
          <ValueBlock label="organ_type" value={disease.organ_type} />
          <ValueBlock label="ai_label" value={disease.ai_label} />
          <ValueBlock label="symptoms" value={disease.symptoms} />
          <ValueBlock label="prevention" value={disease.prevention} />
          <ValueBlock label="created_at" value={disease.created_at} />
          <ValueBlock label="updated_at" value={disease.updated_at} />
        </Stack>

        <Divider />

        <DiseaseMapProfilePanel profile={disease.map_profile} />

        <Divider />

        <NestedSection
          title="Causes"
          items={disease.causes}
          renderItem={(cause) => (
            <ListItemText
              primary={cause.title}
              secondary={cause.description || 'No description'}
            />
          )}
        />

        <Divider />

        <NestedSection
          title="Treatments"
          items={disease.treatments}
          renderItem={(treatment) => (
            <ListItemText
              primary={treatment.title}
              secondary={treatment.description || 'No description'}
            />
          )}
        />

        <Divider />

        <NestedSection
          title="Resources"
          items={disease.resources}
          renderItem={(resource) => (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {resource.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.35 }}>
                {resource.description || 'No description'}
              </Typography>
              <Link href={resource.url} target="_blank" rel="noreferrer" underline="hover" color="primary.dark">
                {resource.url}
              </Link>
            </Box>
          )}
        />
      </Stack>
    </PanelCard>
  );
}
