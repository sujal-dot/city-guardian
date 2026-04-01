import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/hooks/useAuth';
import { isValidEmailFormat, normalizeEmail } from '@/lib/email';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const { signIn, user } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEmailValid = !email || isValidEmailFormat(email);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/landing', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmailFormat(normalizedEmail)) {
      setEmailError('Enter a valid email address (example: name@example.com).');
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address format.',
        variant: 'destructive',
      });
      return;
    }

    setEmailError('');
    const isAdminLogin = normalizedEmail === 'sujaluttekar77@gmail.com' && password === 'Sujal@123';
    if (!selectedRole && !isAdminLogin) {
      toast({ title: 'Select a role', description: 'Choose Citizen, Police, or Admin.' });
      return;
    }
    
    setIsLoading(true);
    const roleForLogin = selectedRole ?? (isAdminLogin ? 'admin' : null);
    const { error } = await signIn(normalizedEmail, password, roleForLogin);

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    const successTitle =
      roleForLogin === 'admin'
        ? 'Logged in as Admin'
        : roleForLogin === 'police'
        ? 'Logged in as Police'
        : roleForLogin === 'citizen'
        ? 'Logged in as Citizen'
        : 'Welcome back!';
    toast({ title: successTitle });
    navigate('/landing', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>Select your role and sign in</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Button
              type="button"
              variant={selectedRole === 'citizen' ? 'default' : 'outline'}
              onClick={() => setSelectedRole('citizen')}
              disabled={isLoading}
            >
              Citizen
            </Button>
            <Button
              type="button"
              variant={selectedRole === 'police' ? 'default' : 'outline'}
              onClick={() => setSelectedRole('police')}
              disabled={isLoading}
            >
              Police
            </Button>
            <Button
              type="button"
              variant={selectedRole === 'admin' ? 'default' : 'outline'}
              onClick={() => setSelectedRole('admin')}
              disabled={isLoading}
            >
              Admin
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  const nextEmail = e.target.value;
                  setEmail(nextEmail);
                  if (emailError) {
                    setEmailError(
                      isValidEmailFormat(nextEmail)
                        ? ''
                        : 'Enter a valid email address (example: name@example.com).'
                    );
                  }
                }}
                onBlur={() => {
                  if (!email) return;
                  setEmailError(
                    isValidEmailFormat(email)
                      ? ''
                      : 'Enter a valid email address (example: name@example.com).'
                  );
                }}
                pattern="^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"
                title="Enter a valid email address (example: name@example.com)."
                aria-invalid={!isEmailValid}
                required
                disabled={isLoading}
              />
              {emailError ? (
                <p className="text-xs text-destructive">{emailError}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !isEmailValid}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
