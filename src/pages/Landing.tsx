import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Landing() {
  const { user, effectiveRoles, isLoading } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Route based on role
    if (effectiveRoles.includes('admin') || effectiveRoles.includes('police')) {
      navigate('/', { replace: true });
    } else {
      navigate('/citizen', { replace: true });
    }
  }, [user, effectiveRoles, isLoading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Redirecting to your portal...</p>
    </div>
  );
}
