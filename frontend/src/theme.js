import { alpha, createTheme } from '@mui/material/styles'

const brand = {
  primaryDark: '#124B2F',
  primary: '#1F6A3D',
  primarySoft: '#5E8F63',
  alert: '#C62828',
  warning: '#F2B233',
  background: '#FAFCFA',
  surface: '#FFFFFF',
  surfaceSoft: '#F2F6F2',
  text: '#17231A',
  textSecondary: '#516156',
  border: '#D7E2D8',
}

const shadows = {
  appBar: '0 3px 10px rgba(18, 75, 47, 0.04)',
  card: '0 2px 8px rgba(18, 75, 47, 0.04)',
  cardHover: '0 6px 16px rgba(18, 75, 47, 0.06)',
  popover: '0 8px 18px rgba(18, 75, 47, 0.08)',
}

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: brand.primary,
      light: brand.primarySoft,
      dark: brand.primaryDark,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: brand.primarySoft,
      light: '#7FA383',
      dark: brand.primaryDark,
      contrastText: '#FFFFFF',
    },
    success: {
      main: brand.primary,
      dark: brand.primaryDark,
      light: '#DDE9DE',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: brand.warning,
      light: '#FBEDC0',
      dark: '#A87A16',
      contrastText: brand.text,
    },
    error: {
      main: brand.alert,
      light: '#F8DEDE',
      dark: '#8E1D1D',
      contrastText: '#FFFFFF',
    },
    info: {
      main: brand.primarySoft,
      light: '#E4EDE5',
      dark: '#466C4B',
      contrastText: '#FFFFFF',
    },
    background: {
      default: brand.background,
      paper: brand.surface,
    },
    text: {
      primary: brand.text,
      secondary: brand.textSecondary,
    },
    divider: brand.border,
  },
  spacing: 8,
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", sans-serif',
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: { fontWeight: 700, fontSize: '2.5rem', letterSpacing: '-0.035em', lineHeight: 1.04 },
    h2: { fontWeight: 700, fontSize: '2.1rem', letterSpacing: '-0.03em', lineHeight: 1.06 },
    h3: { fontWeight: 700, fontSize: '1.72rem', letterSpacing: '-0.03em', lineHeight: 1.08 },
    h4: { fontWeight: 700, fontSize: '1.42rem', letterSpacing: '-0.02em', lineHeight: 1.12 },
    h5: { fontWeight: 600, fontSize: '1.12rem', letterSpacing: '-0.015em', lineHeight: 1.16 },
    h6: { fontWeight: 600, fontSize: '0.98rem', letterSpacing: '-0.01em', lineHeight: 1.18 },
    subtitle1: { fontWeight: 600, fontSize: '0.94rem', lineHeight: 1.35, letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 600, fontSize: '0.84rem', lineHeight: 1.35, letterSpacing: '0.005em' },
    body1: { fontWeight: 400, fontSize: '0.94rem', lineHeight: 1.55, letterSpacing: '-0.005em' },
    body2: { fontWeight: 400, fontSize: '0.82rem', lineHeight: 1.5, letterSpacing: '-0.003em' },
    caption: { fontWeight: 400, fontSize: '0.74rem', lineHeight: 1.4, color: brand.textSecondary },
    overline: { fontWeight: 600, letterSpacing: '0.14em', fontSize: '0.68rem', lineHeight: 1.25 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.01em', lineHeight: 1.2 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", sans-serif',
          fontFeatureSettings: '"cv11" 1, "ss01" 1',
        },
        body: {
          backgroundColor: brand.background,
          backgroundImage: 'radial-gradient(circle at top left, rgba(31, 106, 61, 0.06), transparent 26%)',
          color: brand.text,
          fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", sans-serif',
        },
        '::selection': {
          backgroundColor: alpha(brand.primary, 0.14),
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: brand.surface,
          border: `1px solid ${alpha(brand.border, 0.95)}`,
          boxShadow: shadows.card,
        },
        rounded: {
          borderRadius: 6,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: brand.surface,
          border: `1px solid ${brand.border}`,
          boxShadow: shadows.card,
          borderRadius: 6,
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 22,
          '&:last-child': {
            paddingBottom: 22,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(brand.surface, 0.94),
          color: brand.text,
          backdropFilter: 'blur(16px)',
          boxShadow: shadows.appBar,
          borderBottom: `1px solid ${brand.border}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: brand.surface,
          borderRight: `1px solid ${brand.border}`,
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '9px 15px',
          minHeight: 38,
        },
        sizeSmall: {
          minHeight: 30,
          padding: '6px 11px',
        },
        contained: {
          boxShadow: 'none',
        },
        containedPrimary: {
          backgroundImage: 'linear-gradient(180deg, #1F6A3D 0%, #124B2F 100%)',
          '&:hover': {
            boxShadow: shadows.cardHover,
          },
        },
        containedSecondary: {
          backgroundColor: brand.surfaceSoft,
          color: brand.primaryDark,
          '&:hover': {
            backgroundColor: alpha(brand.primarySoft, 0.22),
          },
        },
        containedError: {
          '&:hover': {
            boxShadow: `0 10px 24px ${alpha(brand.alert, 0.2)}`,
          },
        },
        outlined: {
          borderColor: brand.border,
          backgroundColor: alpha(brand.surface, 0.92),
          '&:hover': {
            borderColor: brand.primarySoft,
            backgroundColor: alpha(brand.primary, 0.04),
          },
        },
        text: {
          color: brand.textSecondary,
          '&:hover': {
            backgroundColor: alpha(brand.primary, 0.05),
            color: brand.primaryDark,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          fontWeight: 600,
          height: 26,
          fontSize: '0.74rem',
          lineHeight: 1.1,
          letterSpacing: '0.01em',
          fontVariantNumeric: 'tabular-nums',
        },
        filled: {
          backgroundColor: brand.surfaceSoft,
          color: brand.text,
        },
        colorSuccess: {
          backgroundColor: '#E4F0E4',
          color: brand.primaryDark,
        },
        colorWarning: {
          backgroundColor: '#FFF4D6',
          color: '#8A6512',
        },
        colorError: {
          backgroundColor: '#FBE9E9',
          color: brand.alert,
        },
        colorInfo: {
          backgroundColor: '#EAF1EA',
          color: brand.primaryDark,
        },
        outlined: {
          borderColor: alpha(brand.primary, 0.18),
          backgroundColor: alpha(brand.surfaceSoft, 0.55),
        },
      },
    },
    MuiAlert: {
      defaultProps: {
        variant: 'standard',
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          alignItems: 'flex-start',
          border: `1px solid ${brand.border}`,
          padding: '11px 13px',
        },
        standardError: {
          backgroundColor: '#FBE9E9',
          color: brand.alert,
          borderColor: '#EEC4C4',
        },
        standardWarning: {
          backgroundColor: '#FFF5DB',
          color: '#8A6512',
          borderColor: '#F0D48C',
        },
        standardInfo: {
          backgroundColor: '#EAF3EC',
          color: brand.primaryDark,
          borderColor: '#CFE1D1',
        },
        standardSuccess: {
          backgroundColor: '#EAF3EC',
          color: brand.primaryDark,
          borderColor: '#CFE1D1',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: brand.surface,
          color: brand.text,
          border: `1px solid ${brand.border}`,
          borderRadius: 6,
          boxShadow: shadows.popover,
          padding: '10px 12px',
          fontSize: '0.74rem',
          fontWeight: 500,
          lineHeight: 1.35,
          letterSpacing: '-0.003em',
        },
        arrow: {
          color: brand.surface,
          '&::before': {
            border: `1px solid ${brand.border}`,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: alpha(brand.surface, 0.98),
          minHeight: 42,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: brand.primarySoft,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: brand.primary,
            borderWidth: 1.5,
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: brand.alert,
          },
        },
        notchedOutline: {
          borderColor: brand.border,
        },
        input: {
          paddingTop: 10,
          paddingBottom: 10,
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 2,
          marginRight: 2,
          fontSize: '0.72rem',
          fontWeight: 400,
          lineHeight: 1.35,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: brand.textSecondary,
          fontWeight: 500,
          fontSize: '0.84rem',
          letterSpacing: '-0.003em',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          display: 'flex',
          alignItems: 'center',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 6,
          border: `1px solid ${brand.border}`,
          boxShadow: shadows.popover,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '18px 20px 10px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '8px 20px 18px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '0 20px 18px',
          gap: 8,
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderCollapse: 'separate',
          borderSpacing: 0,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: brand.surfaceSoft,
          color: brand.textSecondary,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: '0.68rem',
          borderBottom: `1px solid ${brand.border}`,
          paddingTop: 11,
          paddingBottom: 11,
        },
        body: {
          borderBottom: `1px solid ${alpha(brand.border, 0.8)}`,
          paddingTop: 11,
          paddingBottom: 11,
          fontSize: '0.8rem',
          fontWeight: 400,
          lineHeight: 1.45,
          fontVariantNumeric: 'tabular-nums',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: alpha(brand.primary, 0.035),
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          marginBottom: 4,
          paddingTop: 8,
          paddingBottom: 8,
          '&:hover': {
            backgroundColor: alpha(brand.primary, 0.06),
          },
          '&.Mui-selected': {
            backgroundColor: alpha(brand.primary, 0.1),
            color: brand.primaryDark,
            '&:hover': {
              backgroundColor: alpha(brand.primary, 0.14),
            },
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
          backgroundColor: brand.primary,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: 'none',
          fontWeight: 600,
          color: brand.textSecondary,
          '&.Mui-selected': {
            color: brand.primaryDark,
          },
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          transform: 'none',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: alpha(brand.border, 0.9),
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: brand.primaryDark,
          color: '#FFFFFF',
          borderRadius: 6,
          boxShadow: shadows.popover,
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: `1px solid ${brand.border}`,
          borderRadius: 6,
          backgroundColor: brand.surface,
          '& .MuiDataGrid-columnSeparator': {
            color: alpha(brand.border, 0.6),
          },
        },
        columnHeaders: {
          backgroundColor: brand.surfaceSoft,
          borderBottom: `1px solid ${brand.border}`,
        },
        columnHeaderTitle: {
          fontWeight: 600,
          fontSize: '0.68rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: brand.textSecondary,
        },
        cell: {
          borderBottomColor: alpha(brand.border, 0.8),
          fontSize: '0.8rem',
          fontWeight: 400,
          lineHeight: 1.45,
          fontVariantNumeric: 'tabular-nums',
        },
        row: {
          '&:hover': {
            backgroundColor: alpha(brand.primary, 0.03),
          },
          '&.Mui-selected': {
            backgroundColor: alpha(brand.primary, 0.08),
          },
        },
        footerContainer: {
          borderTop: `1px solid ${brand.border}`,
          backgroundColor: brand.surfaceSoft,
          minHeight: 52,
        },
        toolbarContainer: {
          padding: '12px 14px',
          borderBottom: `1px solid ${brand.border}`,
        },
        overlay: {
          backgroundColor: alpha(brand.surface, 0.9),
        },
      },
    },
  },
})

export default theme
