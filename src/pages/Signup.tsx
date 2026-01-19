import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, UserCog, BadgeCheck, User, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AppRole } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ROLES = [
  { 
    id: 'citizen' as const, 
    label: 'Citizen', 
    icon: User, 
    description: 'Public citizen access',
    requiresApproval: false 
  },
  { 
    id: 'police' as const, 
    label: 'Police', 
    icon: BadgeCheck, 
    description: 'Law enforcement officer',
    requiresApproval: true 
  },
  { 
    id: 'admin' as const, 
    label: 'Admin', 
    icon: UserCog, 
    description: 'System administrator access',
    requiresApproval: true 
  },
];

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const { signUp, user } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/landing', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    
    setIsLoading(true);

    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, fullName, selectedRole);

    if (error) {
      toast({
        title: 'Signup Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const roleInfo = ROLES.find(r => r.id === selectedRole);
    
    if (roleInfo?.requiresApproval) {
      toast({
        title: 'Account Created!',
        description: `Your ${selectedRole} account requires admin approval. You'll be notified once approved.`,
      });
    } else {
      toast({
        title: 'Account Created!',
        description: 'Welcome to the Crime Prediction & Prevention System.',
      });
    }

    navigate('/landing', { replace: true });
  };

  const handleRoleSelect = (role: AppRole) => {
    setSelectedRole(role);
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setEmail('');
    setPassword('');
    setFullName('');
  };

  const currentRoleInfo = ROLES.find(r => r.id === selectedRole);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {selectedRole ? 'Create Account' : 'Select Your Role'}
          </CardTitle>
          <CardDescription>
            {selectedRole 
              ? `Sign up as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`
              : 'Choose your role to join the Crime Prediction & Prevention System'
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
                    <div className="text-left flex-1">
                      <p className="font-semibold">{role.label}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                    {role.requiresApproval && (
                      <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded">
                        Requires Approval
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Signup Form */
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

              {currentRoleInfo?.requiresApproval && (
                <Alert className="bg-amber-500/10 border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-200">
                    {selectedRole === 'police' 
                      ? 'Police accounts require admin verification. You will start with citizen access until approved.'
                      : 'Admin accounts require verification. You will start with citizen access until approved.'
                    }
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
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
                    minLength={6}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be at least 6 characters
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </>
          )}

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
