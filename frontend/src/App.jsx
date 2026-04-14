import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, Typography } from '@mui/material';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/layouts/MainLayout';
import Login from '@/features/auth/Login';

// Placeholder components
function DashboardPlaceholder() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ fontWeight: 600 }}>
        Dashboard — Protected Area
      </Typography>
    </Box>
  );
}

// React Query Client setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes wrapped inside ProtectedRoute */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<DashboardPlaceholder />} />
            <Route path="/review" element={<Box sx={{p: 2}}><Typography variant="h4">Review</Typography></Box>} />
            <Route path="/devices" element={<Box sx={{p: 2}}><Typography variant="h4">Devices</Typography></Box>} />
            <Route path="/catalog" element={<Box sx={{p: 2}}><Typography variant="h4">Catalog</Typography></Box>} />
            
            {/* Default route redirect to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>

        {/* Catch-all route to handle 404s */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;
