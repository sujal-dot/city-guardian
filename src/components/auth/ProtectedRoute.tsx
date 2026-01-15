import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext, } from '@/contexts/AuthContext';
import { AppRole } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
  requireAuth?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requiredRoles = [],
  requireAuth = true 
}: ProtectedRouteProps) => {
  const { user, roles, isLoading } = useAuthContext();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((role) => roles.includes(role));
    if (!hasRequiredRole) {
      // Redirect citizens to citizen portal, others to login
      if (roles.includes('citizen')) {
        return <Navigate to="/citizen" replace />;
      }
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
};
