import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useEffect } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import AdminRoute from '@/components/AdminRoute';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/layouts/MainLayout';
import useAuthStore from '@/store/authStore';

const AccountPage = lazy(() => import('@/features/account/AccountPage'));
const CatalogPage = lazy(() => import('@/features/catalog/CatalogPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const DevicesPage = lazy(() => import('@/features/devices/DevicesPage'));
const InspectionsPage = lazy(() => import('@/features/inspections/InspectionsPage'));
const Login = lazy(() => import('@/features/auth/Login'));
const MonitoringPage = lazy(() => import('@/features/monitoring/MonitoringPage'));
const ReviewPage = lazy(() => import('@/features/review/ReviewPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

function AuthBootstrap() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthReady = useAuthStore((state) => state.isAuthReady);
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    if (!hasHydrated || isAuthReady || isRestoring) {
      return;
    }

    restoreSession();
  }, [hasHydrated, isAuthReady, isRestoring, restoreSession]);

  return null;
}

function RouteFallback() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
      <Stack spacing={2} alignItems="center">
        <CircularProgress />
        <Typography color="text.secondary">Loading page...</Typography>
      </Stack>
    </Box>
  );
}

function withRouteSuspense(element) {
  return (
    <Suspense fallback={<RouteFallback />}>
      {element}
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      <Routes>
        <Route path="/login" element={withRouteSuspense(<Login />)} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/account" element={withRouteSuspense(<AccountPage />)} />
            <Route path="/dashboard" element={withRouteSuspense(<DashboardPage />)} />
            <Route element={<AdminRoute />}>
              <Route path="/monitoring" element={withRouteSuspense(<MonitoringPage />)} />
            </Route>
            <Route path="/inspections" element={withRouteSuspense(<InspectionsPage />)} />
            <Route path="/review" element={withRouteSuspense(<ReviewPage />)} />
            <Route path="/devices" element={withRouteSuspense(<DevicesPage />)} />
            <Route path="/catalog" element={withRouteSuspense(<CatalogPage />)} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;
