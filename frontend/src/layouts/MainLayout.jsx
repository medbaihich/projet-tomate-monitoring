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
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  Button,
} from '@mui/material';
import {
  AdminPanelSettings as AdminPanelSettingsIcon,
  Menu as MenuIcon,
  MonitorHeart as MonitorHeartIcon,
  Dashboard as DashboardIcon,
  FactCheck as FactCheckIcon,
  Router as RouterIcon,
  MenuBook as MenuBookIcon,
  Logout as LogoutIcon,
  PrecisionManufacturing as PrecisionManufacturingIcon,
  RuleFolder as RuleFolderIcon,
} from '@mui/icons-material';
import azuraLogo from '@/assets/branding/azura_logo.png';
import useAuthStore from '@/store/authStore';

const drawerWidth = 216;

export default function MainLayout(props) {
  const { window } = props;
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

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
  const isAdmin = normalizedRole === 'admin';
  const displayName = user?.username || 'Operator';
  const isAccountRoute = location.pathname.startsWith('/account');
  const roleIcon = normalizedRole === 'admin'
    ? <AdminPanelSettingsIcon fontSize="small" />
    : <PrecisionManufacturingIcon fontSize="small" />;
  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    ...(isAdmin ? [{ text: 'Monitoring', icon: <MonitorHeartIcon />, path: '/monitoring' }] : []),
    { text: 'Inspections', icon: <RuleFolderIcon />, path: '/inspections' },
    { text: 'Review', icon: <FactCheckIcon />, path: '/review' },
    { text: 'Devices', icon: <RouterIcon />, path: '/devices' },
    { text: 'Catalog', icon: <MenuBookIcon />, path: '/catalog' },
  ];

  const drawer = (
    <Box sx={{ px: 1, py: 1.5 }}>
      <Stack spacing={1.25}>
        <ListItemButton
          onClick={() => handleNavigation('/account')}
          selected={isAccountRoute}
          aria-label="Open my profile"
          sx={{
            px: 0.9,
            py: 0.75,
            mb: 0.2,
            minHeight: 'unset',
            borderRadius: 1,
            bgcolor: isAccountRoute ? 'rgba(31, 106, 61, 0.08)' : 'background.paper',
            border: '1px solid',
            borderColor: isAccountRoute ? 'rgba(31, 106, 61, 0.16)' : 'divider',
            boxShadow: '0 1px 4px rgba(18, 75, 47, 0.03)',
            alignItems: 'center',
            '&:hover': {
              bgcolor: isAccountRoute ? 'rgba(31, 106, 61, 0.1)' : 'rgba(31, 106, 61, 0.04)',
            },
            '&.Mui-selected': {
              bgcolor: 'rgba(31, 106, 61, 0.08)',
            },
          }}
        >
          <Stack direction="row" spacing={0.85} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: 0.65,
                bgcolor: 'rgba(31, 106, 61, 0.08)',
                color: 'primary.dark',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {roleIcon}
            </Box>
            <Stack spacing={0.05} sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1, fontSize: '0.64rem' }}
              >
                {normalizedRole === 'admin' ? 'Administrator' : 'Operator'}
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  lineHeight: 1.05,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1, fontSize: '0.68rem' }}>
                {roleName}
              </Typography>
            </Stack>
          </Stack>
        </ListItemButton>

        <List sx={{ m: 0, p: 0 }}>
            {menuItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);

              return (
                <ListItem key={item.text} disablePadding sx={{ mb: 0.25 }}>
                  <ListItemButton
                    selected={isActive}
                    onClick={() => handleNavigation(item.path)}
                    sx={{
                      position: 'relative',
                      minHeight: 40,
                      px: 0.75,
                      py: 0.625,
                      borderRadius: 0.875,
                      bgcolor: isActive ? 'rgba(31, 106, 61, 0.08)' : 'transparent',
                      '&:hover': {
                        bgcolor: isActive ? 'rgba(31, 106, 61, 0.1)' : 'rgba(31, 106, 61, 0.04)',
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
                            bgcolor: 'primary.main',
                          }
                        : undefined,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 34,
                        color: isActive ? 'primary.dark' : 'text.secondary',
                      }}
                    >
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 0.75,
                          bgcolor: isActive ? 'rgba(31, 106, 61, 0.1)' : 'transparent',
                        }}
                      >
                        {item.icon}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      secondary={isActive ? 'Current section' : null}
                      sx={{
                        my: 0,
                        '& .MuiListItemText-primary': {
                          fontWeight: isActive ? 700 : 600,
                          fontSize: '0.8rem',
                          color: isActive ? 'text.primary' : 'text.secondary',
                          letterSpacing: '-0.005em',
                        },
                        '& .MuiListItemText-secondary': {
                          color: 'primary.dark',
                          fontSize: '0.66rem',
                          mt: 0.125,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
        </List>

      </Stack>
    </Box>
  );

  const container = window !== undefined ? () => window().document.body : undefined;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255, 255, 255, 0.96)',
        }}
      >
        <Toolbar sx={{ minHeight: 50, px: { xs: 1, sm: 1.25 } }}>
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
              borderColor: 'divider',
            }}
          >
            <Chip
              size="small"
              label="Live system"
              color="success"
              variant="outlined"
              sx={{
                fontSize: '0.68rem',
                letterSpacing: '0.02em',
                bgcolor: 'rgba(255,255,255,0.72)',
              }}
            />
            <Button
              color="error"
              variant="outlined"
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
              size="small"
              sx={{
                minHeight: 30,
                px: 1.1,
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
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
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
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar sx={{ minHeight: 52 }} />
        <Box
          sx={{
            px: { xs: 1, sm: 1.5, lg: 2 },
            py: { xs: 1, sm: 1.25, lg: 1.5 },
            maxWidth: 1400,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
