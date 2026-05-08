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
        minHeight: 96,
        border: '1px dashed',
        borderColor: 'rgba(255,255,255,0.14)',
        borderRadius: 2.5,
        bgcolor: 'rgba(255,255,255,0.03)',
        px: 2.5,
        textAlign: 'center',
      }}
    >
      <Stack spacing={0.75} sx={{ maxWidth: 320 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: '#ECF4EF' }}>
          No operational data
        </Typography>
        <Typography variant="body2" sx={{ color: '#8FA39C' }}>
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
        bgcolor: '#0F1715',
        border: '1px solid',
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 2,
        minWidth: 180,
        boxShadow: '0 18px 38px rgba(0, 0, 0, 0.35)',
      }}
    >
      {label ? (
        <Typography
          variant="caption"
          sx={{ display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#90A39B' }}
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
              <Typography variant="body2" sx={{ color: '#D3DDD8' }}>
                {entry.name}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#F7FBF8' }}>
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
    <Stack spacing={0.5} sx={{ width: '100%', minWidth: 0 }}>
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
                px: 1,
                py: 0.5,
                borderRadius: 2,
                bgcolor: alpha(item.color, 0.12),
                border: '1px solid',
                borderColor: alpha(item.color, 0.2),
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                <Typography variant="body2" sx={{ minWidth: 0, fontWeight: 600, color: '#EBF3EE' }}>
                  {item.label}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography
                  variant="caption"
                  sx={{ minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#90A39B' }}
                >
                  {percentage}%
                </Typography>
                <Chip
                  size="small"
                  label={formatter(item.value)}
                  sx={{
                    height: 22,
                    bgcolor: 'rgba(255,255,255,0.05)',
                    border: '1px solid',
                    borderColor: 'rgba(255,255,255,0.12)',
                    color: '#ECF4EF',
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
    <Stack spacing={0.65}>
      <Box
        sx={{
          width: '100%',
          minWidth: 0,
          height: 88,
          borderRadius: 2.5,
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid',
          borderColor: 'rgba(255,255,255,0.1)',
          p: 0.625,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 6, right: 10, left: 4, bottom: 6 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.09)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#8EA39B', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: '#ECF4EF', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={62}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
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
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.6} alignItems="center">
      <Box
        sx={{
          width: '100%',
          maxWidth: 112,
          height: 104,
          position: 'relative',
          borderRadius: 2.5,
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid',
          borderColor: 'rgba(255,255,255,0.1)',
          p: 0.625,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={25}
              outerRadius={37}
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
              color: '#8EA39B',
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
              color: '#F6FBF7',
            }}
          >
            {centerValue}
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ width: '100%' }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 0.6,
            textAlign: { xs: 'center', lg: 'left' },
            fontSize: '0.66rem',
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
            color: '#8EA39B',
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
          minWidth: 0,
          height: 150,
          borderRadius: 2.5,
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid',
          borderColor: 'rgba(255,255,255,0.1)',
          p: 0.5,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 6, left: -8, bottom: 4 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: '#8EA39B', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#8EA39B', fontSize: 9 }} axisLine={false} tickLine={false} />
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
              stroke="#7AE27A"
              strokeWidth={2}
              dot={{ r: 2.25, fill: '#7AE27A' }}
              activeDot={{ r: 3.5, fill: '#B6F29C' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      <Stack direction="row" spacing={0.75} justifyContent="center" useFlexGap flexWrap="wrap">
        <Chip
          size="small"
          variant="outlined"
          label="Inspections"
          sx={{
            color: '#DDF4E0',
            borderColor: 'rgba(122,226,122,0.28)',
            bgcolor: 'rgba(122,226,122,0.08)',
          }}
        />
      </Stack>
    </Stack>
  );
}
