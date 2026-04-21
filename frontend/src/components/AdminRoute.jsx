import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '@/store/authStore';

export default function AdminRoute() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const normalizedRole = (user?.role?.name || '').trim().toLowerCase();

  if (normalizedRole !== 'admin') {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
