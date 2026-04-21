import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import AdminRoute from '@/components/AdminRoute';
import ProtectedRoute from '@/components/ProtectedRoute';
import AccountPage from '@/features/account/AccountPage';
import CatalogPage from '@/features/catalog/CatalogPage';
import DashboardPage from '@/features/dashboard/DashboardPage';
import MainLayout from '@/layouts/MainLayout';
import DevicesPage from '@/features/devices/DevicesPage';
import InspectionsPage from '@/features/inspections/InspectionsPage';
import Login from '@/features/auth/Login';
import MonitoringPage from '@/features/monitoring/MonitoringPage';
import ReviewPage from '@/features/review/ReviewPage';
import useAuthStore from '@/store/authStore';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/account" element={<AccountPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/monitoring" element={<MonitoringPage />} />
            </Route>
            <Route path="/inspections" element={<InspectionsPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;
