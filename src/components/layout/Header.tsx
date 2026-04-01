import { Search, User, AlertTriangle, Wifi, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { CrimeAlertPanel } from '@/components/alerts/CrimeAlertPanel';
import { useCrimeAlerts } from '@/hooks/useCrimeAlerts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, signOut, effectiveRoles } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const canViewAlerts = effectiveRoles.includes('police') || effectiveRoles.includes('admin');
  const crimeAlerts = useCrimeAlerts({ enabled: canViewAlerts });
  const roleLabel =
    effectiveRoles.length > 0
      ? effectiveRoles
          .map((role) => role.charAt(0).toUpperCase() + role.slice(1))
          .join(' / ')
      : 'User';
  const fallbackNameByRole = effectiveRoles.includes('admin')
    ? 'Administrator'
    : effectiveRoles.includes('police')
    ? 'Police Officer'
    : effectiveRoles.includes('citizen')
    ? 'Citizen User'
    : 'User';
  const metadataName =
    typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name.trim()
      : typeof user?.user_metadata?.name === 'string'
      ? user.user_metadata.name.trim()
      : '';
  const emailHandle = user?.email ? user.email.split('@')[0].replace(/[._-]+/g, ' ') : '';
  const displayName = (metadataName || emailHandle || fallbackNameByRole)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const isCitizenUser = effectiveRoles.includes('citizen');
  const primaryIdentityLabel = displayName;
  const secondaryIdentityLabel = isCitizenUser ? user?.email : null;

  const currentTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const currentDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: 'Logout Failed',
        description: `${error.message}. You have been signed out locally.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Logged Out',
        description: 'You have been logged out successfully.',
      });
    }
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-6">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Live Indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border">
          <Wifi className="h-3.5 w-3.5 text-risk-safe animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">LIVE</span>
        </div>

        {/* Date/Time */}
        <div className="hidden lg:block text-right">
          <p className="text-sm font-mono text-foreground">{currentTime}</p>
          <p className="text-xs text-muted-foreground">{currentDate}</p>
        </div>

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search incidents, locations..."
            className="w-64 pl-9 bg-secondary/50 border-border"
          />
        </div>

        {/* Crime Alerts Panel */}
        {canViewAlerts && (
          <>
            <CrimeAlertPanel
              alerts={crimeAlerts.alerts}
              unreadCount={crimeAlerts.unreadCount}
              markAsRead={crimeAlerts.markAsRead}
              markAllAsRead={crimeAlerts.markAllAsRead}
              clearAlerts={crimeAlerts.clearAlerts}
            />

            {/* Active Alert Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-risk-high/10 border border-risk-high/30">
              <AlertTriangle className="h-4 w-4 text-risk-high" />
              <span className="text-xs font-medium text-risk-high">
                {crimeAlerts.unreadCount > 0 ? `${crimeAlerts.unreadCount} Active Alerts` : 'No Active Alerts'}
              </span>
            </div>
          </>
        )}

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full bg-secondary">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{primaryIdentityLabel}</p>
                {secondaryIdentityLabel ? (
                  <p className="text-xs leading-none text-muted-foreground/80">{secondaryIdentityLabel}</p>
                ) : null}
                <p className="text-xs leading-none text-muted-foreground">
                  {roleLabel}
                </p>
                {user?.email && !secondaryIdentityLabel && primaryIdentityLabel !== user.email ? (
                  <p className="text-xs leading-none text-muted-foreground/80">{user.email}</p>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
