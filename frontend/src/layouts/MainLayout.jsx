import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Chip,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Stack,
  Toolbar,
  Tooltip,
  Button,
} from '@mui/material';
import {
  AdminPanelSettings as AdminPanelSettingsIcon,
  DarkModeOutlined as DarkModeOutlinedIcon,
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  FactCheck as FactCheckIcon,
  LightModeOutlined as LightModeOutlinedIcon,
  QueryStats as QueryStatsIcon,
  Router as RouterIcon,
  MenuBook as MenuBookIcon,
  Logout as LogoutIcon,
  PrecisionManufacturing as PrecisionManufacturingIcon,
  RuleFolder as RuleFolderIcon,
} from '@mui/icons-material';
import azuraLogo from '@/assets/branding/azura_logo.png';
import useAuthStore from '@/store/authStore';
import { useThemeMode } from '@/theme-mode-context';

const drawerWidth = 72;
const SHELL_BACKGROUND = 'var(--shell-background)';
const SHELL_CHROME_OVERLAY = 'var(--shell-chrome-overlay)';
const SHELL_BORDER = 'var(--shell-border)';
const SHELL_TEXT = 'var(--shell-text)';
const SHELL_TEXT_MUTED = 'var(--shell-text-muted)';
const SHELL_ACCENT_BG = 'var(--shell-accent-bg)';
const SHELL_ACCENT_BORDER = 'var(--shell-accent-border)';
const SHELL_ACCENT_STRONG_BG = 'var(--shell-accent-strong-bg)';
const SHELL_SURFACE_SOFT = 'var(--shell-surface-soft)';
const SHELL_SURFACE_SOFT_HOVER = 'var(--shell-surface-soft-hover)';
const SHELL_CONTROL_BG = 'var(--shell-control-bg)';
const SHELL_CONTROL_HOVER = 'var(--shell-control-hover)';
const SHELL_BORDER_STRONG = 'var(--shell-border-strong)';
const SHELL_LIVE_BG = 'var(--shell-live-bg)';
const SHELL_LIVE_BORDER = 'var(--shell-live-border)';
const SHELL_LIVE_TEXT = 'var(--shell-live-text)';
const SHELL_ICON_STRONG = 'var(--shell-icon-strong)';
const SHELL_ICON_ACTIVE = 'var(--shell-icon-active)';

export default function MainLayout(props) {
  const { window } = props;
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { mode, toggleMode } = useThemeMode();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const roleName = user?.role?.name?.trim() || 'Operator';
  const normalizedRole = roleName.toLowerCase();
  const displayName = user?.username || 'Operator';
  const isAccountRoute = location.pathname.startsWith('/account');
  const roleIcon = normalizedRole === 'admin'
    ? <AdminPanelSettingsIcon fontSize="small" />
    : <PrecisionManufacturingIcon fontSize="small" />;

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    ...(normalizedRole === 'admin'
      ? [{ text: 'Monitoring', icon: <QueryStatsIcon />, path: '/monitoring' }]
      : []),
    { text: 'Inspections', icon: <RuleFolderIcon />, path: '/inspections' },
    { text: 'Review', icon: <FactCheckIcon />, path: '/review' },
    { text: 'Devices', icon: <RouterIcon />, path: '/devices' },
    { text: 'Catalog', icon: <MenuBookIcon />, path: '/catalog' },
  ];

  const drawer = (
    <Box sx={{ px: 0.75, py: 1.25 }}>
      <Stack spacing={1.5} alignItems="center">
        <Tooltip title={`${displayName} - ${roleName}`} placement="right">
          <ListItemButton
            onClick={() => handleNavigation('/account')}
            selected={isAccountRoute}
            aria-label="Open my profile"
            sx={{
              width: 48,
              height: 48,
              p: 0,
              minHeight: 'unset',
              borderRadius: 2,
              bgcolor: isAccountRoute ? SHELL_ACCENT_BG : SHELL_SURFACE_SOFT,
              border: '1px solid',
              borderColor: isAccountRoute ? SHELL_ACCENT_BORDER : SHELL_BORDER,
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.14)',
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover': {
                bgcolor: isAccountRoute ? SHELL_ACCENT_STRONG_BG : SHELL_SURFACE_SOFT_HOVER,
              },
              '&.Mui-selected': {
                bgcolor: SHELL_ACCENT_BG,
              },
            }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: 1,
                bgcolor: SHELL_ACCENT_STRONG_BG,
                color: SHELL_ICON_STRONG,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {roleIcon}
            </Box>
          </ListItemButton>
        </Tooltip>

        <List sx={{ m: 0, p: 0, width: '100%' }}>
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);

            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.6, justifyContent: 'center' }}>
                <Tooltip title={item.text} placement="right">
                  <ListItemButton
                    selected={isActive}
                    onClick={() => handleNavigation(item.path)}
                    aria-label={item.text}
                    sx={{
                      position: 'relative',
                      width: 48,
                      height: 48,
                      minHeight: 48,
                      p: 0,
                      borderRadius: 2,
                      justifyContent: 'center',
                      bgcolor: isActive ? SHELL_ACCENT_BG : 'transparent',
                      border: '1px solid',
                      borderColor: isActive ? SHELL_ACCENT_BORDER : 'transparent',
                      '&:hover': {
                        bgcolor: isActive ? SHELL_ACCENT_STRONG_BG : SHELL_SURFACE_SOFT,
                      },
                      '&::before': isActive
                        ? {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 8,
                            bottom: 8,
                            width: 2,
                            borderRadius: 999,
                            bgcolor: SHELL_ICON_STRONG,
                          }
                        : undefined,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        color: isActive ? SHELL_ICON_ACTIVE : SHELL_TEXT_MUTED,
                        justifyContent: 'center',
                      }}
                    >
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 1,
                          bgcolor: isActive ? SHELL_ACCENT_STRONG_BG : 'transparent',
                        }}
                      >
                        {item.icon}
                      </Box>
                    </ListItemIcon>
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Stack>
    </Box>
  );

  const container = window !== undefined ? () => window().document.body : undefined;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          borderBottom: '1px solid',
          borderColor: SHELL_BORDER,
          bgcolor: SHELL_BACKGROUND,
          color: SHELL_TEXT,
          backgroundImage: SHELL_CHROME_OVERLAY,
        }}
      >
        <Toolbar sx={{ minHeight: 48, px: { xs: 1, sm: 1.25 } }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1.5, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexGrow: 1 }}>
            <Box
              component="img"
              src={azuraLogo}
              alt="Azura"
              sx={{
                height: { xs: 24, sm: 28 },
                width: 'auto',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
          </Stack>

          <Stack
            direction="row"
            spacing={0.625}
            alignItems="center"
            sx={{
              pl: 1,
              borderLeft: '1px solid',
              borderColor: SHELL_BORDER,
            }}
          >
            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton
                onClick={toggleMode}
                aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                size="small"
                sx={{
                  color: SHELL_TEXT,
                  border: '1px solid',
                  borderColor: SHELL_BORDER,
                  bgcolor: SHELL_CONTROL_BG,
                  width: 30,
                  height: 30,
                  '&:hover': {
                    borderColor: SHELL_BORDER_STRONG,
                    bgcolor: SHELL_CONTROL_HOVER,
                  },
                }}
              >
                {mode === 'dark' ? (
                  <LightModeOutlinedIcon sx={{ fontSize: 18 }} />
                ) : (
                  <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </Tooltip>
            <Chip
              size="small"
              label="Live system"
              color="success"
              variant="outlined"
              sx={{
                fontSize: '0.68rem',
                letterSpacing: '0.02em',
                bgcolor: SHELL_LIVE_BG,
                color: SHELL_LIVE_TEXT,
                borderColor: SHELL_LIVE_BORDER,
              }}
            />
            <Button
              variant="outlined"
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
              size="small"
              sx={{
                minHeight: 30,
                px: 1.1,
                color: SHELL_TEXT,
                borderColor: SHELL_BORDER,
                bgcolor: SHELL_CONTROL_BG,
                '&:hover': {
                  borderColor: SHELL_BORDER_STRONG,
                  bgcolor: SHELL_CONTROL_HOVER,
                },
              }}
            >
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          container={container}
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              bgcolor: SHELL_BACKGROUND,
              color: SHELL_TEXT,
              borderRight: `1px solid ${SHELL_BORDER}`,
              backgroundImage: SHELL_CHROME_OVERLAY,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              overflowX: 'hidden',
              bgcolor: SHELL_BACKGROUND,
              color: SHELL_TEXT,
              borderRight: `1px solid ${SHELL_BORDER}`,
              backgroundImage: SHELL_CHROME_OVERLAY,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0,
          minHeight: '100vh',
          overflowX: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar sx={{ minHeight: 52 }} />
        <Box
          sx={{
            minWidth: 0,
            overflowX: 'hidden',
            px: { xs: 1, sm: 1.25, lg: location.pathname.startsWith('/dashboard') ? 1.5 : 2 },
            py: { xs: 1, sm: 1.25, lg: 1.25 },
            maxWidth: location.pathname.startsWith('/dashboard') ? 'none' : 1400,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
