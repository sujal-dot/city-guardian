import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, UserCog, BadgeCheck, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const DEMO_ACCOUNTS = {
  admin: { email: 'admin@demo.com', password: 'admin123', label: 'Admin', icon: UserCog },
  police: { email: 'police@demo.com', password: 'police123', label: 'Police', icon: BadgeCheck },
  citizen: { email: 'citizen@demo.com', password: 'citizen123', label: 'Citizen', icon: User },
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const { signIn, user } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in
  if (user) {
    navigate('/landing', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Welcome back!',
      description: 'You have successfully logged in.',
    });

    navigate('/landing', { replace: true });
  };

  const handleDemoLogin = async (role: keyof typeof DEMO_ACCOUNTS) => {
    setLoadingDemo(role);
    const { email, password } = DEMO_ACCOUNTS[role];

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Demo Login Failed',
        description: `Demo account not set up. Please create an account with email: ${email} and password: ${password}`,
        variant: 'destructive',
      });
      setLoadingDemo(null);
      return;
    }

    toast({
      title: `Welcome, Demo ${DEMO_ACCOUNTS[role].label}!`,
      description: 'You have successfully logged in.',
    });

    navigate('/landing', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to access Crime Prediction & Prevention System
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Demo Login Buttons */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">Quick Demo Login</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(DEMO_ACCOUNTS).map(([role, { label, icon: Icon }]) => (
                <Button
                  key={role}
                  variant="outline"
                  size="sm"
                  onClick={() => handleDemoLogin(role as keyof typeof DEMO_ACCOUNTS)}
                  disabled={isLoading || loadingDemo !== null}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                >
                  {loadingDemo === role ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or sign in with email
            </span>
          </div>

          {/* Regular Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || loadingDemo !== null}
              />
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
                disabled={isLoading || loadingDemo !== null}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || loadingDemo !== null}>
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

          <div className="text-center text-sm text-muted-foreground">
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
