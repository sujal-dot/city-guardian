import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, BadgeCheck, User, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AppRole } from '@/hooks/useAuth';
import { isValidEmailFormat, normalizeEmail } from '@/lib/email';

const ROLES = [
  { 
    id: 'citizen' as const, 
    label: 'Citizen', 
    icon: User, 
    description: 'Public citizen access'
  },
  { 
    id: 'police' as const, 
    label: 'Police', 
    icon: BadgeCheck, 
    description: 'Law enforcement officer'
  },
];

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const { signUp, user } = useAuthContext();
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
    if (!selectedRole) return;

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

    if (selectedRole === 'admin') {
      toast({
        title: 'Admin signup restricted',
        description: 'New admin accounts can only be assigned by an existing admin.',
        variant: 'destructive',
      });
      return;
    }
    
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

    const { error } = await signUp(normalizedEmail, password, fullName, selectedRole);

    if (error) {
      toast({
        title: 'Signup Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Account Created!',
      description: `Your account was created with the ${selectedRole} role.`,
    });

    navigate('/landing', { replace: true });
  };

  const handleRoleSelect = (role: AppRole) => {
    setSelectedRole(role);
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setEmail('');
    setEmailError('');
    setPassword('');
    setFullName('');
  };

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
                  </button>
                );
              })}
              <p className="text-xs text-center text-muted-foreground">
                Admin accounts are restricted and can only be assigned by an existing admin.
              </p>
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

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder=""
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
                    minLength={6}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be at least 6 characters
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || !isEmailValid}>
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
export { Signup };
