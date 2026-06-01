import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type UserRole } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to their correct dashboard
    const dashboards: Record<UserRole, string> = {
      DOCTOR:  '/doctor/dashboard',
      LAB_TECH: '/lab/dashboard',
      MANAGER: '/manager/dashboard',
    };
    return <Navigate to={dashboards[user.role] ?? '/login'} replace />;
  }

  return <Outlet />;
}
