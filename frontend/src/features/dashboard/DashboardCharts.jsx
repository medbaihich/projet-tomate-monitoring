import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function ChartEmptyState({ message }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 160,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.default',
        px: 2.5,
        textAlign: 'center',
      }}
    >
      <Stack spacing={0.75} sx={{ maxWidth: 320 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          No operational data
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Stack>
    </Box>
  );
}

function DashboardTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <Box
      sx={{
        px: 1.75,
        py: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        minWidth: 180,
        boxShadow: '0 12px 26px rgba(18, 75, 47, 0.08)',
      }}
    >
      {label ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          {labelFormatter ? labelFormatter(label) : label}
        </Typography>
      ) : null}
      <Stack spacing={0.75}>
        {payload.map((entry) => (
          <Stack
            key={`${entry.name}-${entry.dataKey}`}
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {entry.name}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {formatter ? formatter(entry.value, entry.name, entry) : entry.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function BreakdownLegend({ data, formatter = (value) => value }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Stack spacing={1} sx={{ width: '100%' }}>
      {data.map((item) => {
        const percentage = total ? Math.round((item.value / total) * 100) : 0;

        return (
          <Stack
            key={item.key || item.label}
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
            sx={{
              px: 1.25,
              py: 1,
              borderRadius: 1.5,
              bgcolor: alpha(item.color, 0.05),
              border: '1px solid',
              borderColor: alpha(item.color, 0.12),
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
              <Typography variant="body2" sx={{ minWidth: 0, fontWeight: 600 }}>
                {item.label}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              >
                {percentage}%
              </Typography>
              <Chip
                size="small"
                label={formatter(item.value)}
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}

export function DistributionBars({ data, valueFormatter = (value) => value }) {
  if (!data.some((item) => item.value > 0)) {
    return <ChartEmptyState message="The current response set does not contain values for this breakdown." />;
  }

  return (
    <Stack spacing={0.85}>
      <Box
        sx={{
          width: '100%',
          height: 140,
          borderRadius: 1.5,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          p: 0.625,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 6, right: 10, left: 4, bottom: 6 }}>
            <CartesianGrid stroke="#D7E2D8" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#4E5F53', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: '#17231A', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={62}
            />
            <Tooltip
              cursor={{ fill: 'rgba(31, 106, 61, 0.04)' }}
              content={<DashboardTooltip formatter={(value) => valueFormatter(value)} />}
            />
            <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]} barSize={10}>
              {data.map((entry) => (
                <Cell key={entry.key || entry.label} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <BreakdownLegend data={data} formatter={valueFormatter} />
    </Stack>
  );
}

export function DonutBreakdown({ data, centerLabel, centerValue }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <ChartEmptyState message="The current response set does not contain values for this distribution." />;
  }

  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.65} alignItems="center">
      <Box
        sx={{
          width: '100%',
          maxWidth: 164,
          height: 150,
          position: 'relative',
          borderRadius: 1.5,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          p: 0.625,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={34}
              outerRadius={50}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.key || entry.label} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<DashboardTooltip formatter={(value) => `${value} items`} />} />
          </PieChart>
        </ResponsiveContainer>

        <Stack
          spacing={0}
          sx={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            px: 2,
            textAlign: 'center',
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontSize: '0.62rem',
              lineHeight: 1.1,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              mb: 0.45,
            }}
          >
            {centerLabel}
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {centerValue}
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ width: '100%' }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mb: 0.6,
            textAlign: { xs: 'center', lg: 'left' },
            fontSize: '0.66rem',
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          total items
        </Typography>
        <BreakdownLegend data={data} formatter={(value) => `${value}`} />
      </Box>
    </Stack>
  );
}

export function ActivityLineChart({ data }) {
  if (!data.length || data.every((item) => item.count === 0)) {
    return <ChartEmptyState message="Recent inspection records do not contain enough captured timestamps to draw activity." />;
  }

  return (
    <Stack spacing={0.65}>
      <Box
        sx={{
          width: '100%',
          height: 124,
          borderRadius: 1.5,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          p: 0.5,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 6, left: -8, bottom: 4 }}>
            <CartesianGrid stroke="#D7E2D8" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: '#4E5F53', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#4E5F53', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              content={(
                <DashboardTooltip
                  formatter={(value) => `${value} inspections`}
                  labelFormatter={(value) => data.find((item) => item.label === value)?.fullLabel || value}
                />
              )}
            />
            <Line
              type="monotone"
              dataKey="count"
              name="Inspections"
              stroke="#1F6A3D"
              strokeWidth={2}
              dot={{ r: 2.25, fill: '#1F6A3D' }}
              activeDot={{ r: 3.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        <Chip size="small" color="info" variant="outlined" label="Latest 7 capture days" />
        {data.map((item) => (
          <Chip
            key={item.date}
            size="small"
            variant="outlined"
            label={`${item.label}: ${item.count}`}
            sx={{ bgcolor: 'background.paper' }}
          />
        ))}
      </Stack>
    </Stack>
  );
}
