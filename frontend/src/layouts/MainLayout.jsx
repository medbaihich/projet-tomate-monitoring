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
  Menu as MenuIcon,
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

const drawerWidth = 72;

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
  const displayName = user?.username || 'Operator';
  const isAccountRoute = location.pathname.startsWith('/account');
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const roleIcon = normalizedRole === 'admin'
    ? <AdminPanelSettingsIcon fontSize="small" />
    : <PrecisionManufacturingIcon fontSize="small" />;

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
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
              bgcolor: isAccountRoute ? 'rgba(122, 226, 122, 0.1)' : 'rgba(255,255,255,0.04)',
              border: '1px solid',
              borderColor: isAccountRoute ? 'rgba(122, 226, 122, 0.16)' : 'rgba(255,255,255,0.08)',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.14)',
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover': {
                bgcolor: isAccountRoute ? 'rgba(122, 226, 122, 0.12)' : 'rgba(255,255,255,0.06)',
              },
              '&.Mui-selected': {
                bgcolor: 'rgba(122, 226, 122, 0.1)',
              },
            }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: 1,
                bgcolor: 'rgba(122, 226, 122, 0.12)',
                color: '#C8F5C8',
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
                      bgcolor: isActive ? 'rgba(122, 226, 122, 0.1)' : 'transparent',
                      border: '1px solid',
                      borderColor: isActive ? 'rgba(122, 226, 122, 0.16)' : 'transparent',
                      '&:hover': {
                        bgcolor: isActive ? 'rgba(122, 226, 122, 0.12)' : 'rgba(255,255,255,0.05)',
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
                            bgcolor: '#7AE27A',
                          }
                        : undefined,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        color: isActive ? '#D8F7D8' : 'rgba(226,236,231,0.64)',
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
                          bgcolor: isActive ? 'rgba(122, 226, 122, 0.12)' : 'transparent',
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
          borderColor: isDashboardRoute ? 'rgba(255,255,255,0.08)' : 'divider',
          bgcolor: isDashboardRoute ? 'rgba(8, 12, 11, 0.92)' : 'rgba(255, 255, 255, 0.96)',
          color: isDashboardRoute ? '#F2F7F4' : 'text.primary',
          backdropFilter: 'blur(18px)',
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
                bgcolor: isDashboardRoute ? 'rgba(122, 226, 122, 0.08)' : 'rgba(255,255,255,0.72)',
                color: isDashboardRoute ? '#C7F5C6' : undefined,
                borderColor: isDashboardRoute ? 'rgba(122, 226, 122, 0.2)' : undefined,
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
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              bgcolor: '#0C1110',
              color: '#F2F7F4',
              borderRight: '1px solid rgba(255,255,255,0.08)',
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
              bgcolor: '#0C1110',
              color: '#F2F7F4',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
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
            px: { xs: 1, sm: 1.25, lg: isDashboardRoute ? 1.5 : 2 },
            py: { xs: 1, sm: 1.25, lg: 1.25 },
            maxWidth: isDashboardRoute ? 'none' : 1400,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
