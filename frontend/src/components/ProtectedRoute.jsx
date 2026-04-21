import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import useAuthStore from '@/store/authStore';

export default function ProtectedRoute() {
  const isAuthReady = useAuthStore((state) => state.isAuthReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page, but save the current location they were trying to access.
    // This allows us to redirect them back here after successful login if needed.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated, render the child routes
  return <Outlet />;
}
