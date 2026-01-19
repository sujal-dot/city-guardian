import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, UserCog, BadgeCheck, User, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type RoleType = 'admin' | 'police' | 'citizen' | null;

const ROLES = [
  { id: 'admin' as const, label: 'Admin', icon: UserCog, description: 'System administrator access' },
  { id: 'police' as const, label: 'Police', icon: BadgeCheck, description: 'Law enforcement officer' },
  { id: 'citizen' as const, label: 'Citizen', icon: User, description: 'Public citizen access' },
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleType>(null);
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
      description: `You have successfully logged in as ${selectedRole}.`,
    });

    navigate('/landing', { replace: true });
  };

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {selectedRole ? 'Sign In' : 'Select Your Role'}
          </CardTitle>
          <CardDescription>
            {selectedRole 
              ? `Sign in as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`
              : 'Choose your role to access the Crime Prediction & Prevention System'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!selectedRole ? (
            /* Role Selection */
            <div className="space-y-3">
              {ROLES.map((role) => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all",
                      "hover:border-primary hover:bg-primary/5",
                      "border-border bg-card"
                    )}
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">{role.label}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Login Form */
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToRoles}
                className="mb-2 -ml-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Change Role
              </Button>

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
                    disabled={isLoading}
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
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
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
            </>
          )}

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
