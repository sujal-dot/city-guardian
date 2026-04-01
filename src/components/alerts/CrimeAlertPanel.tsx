import { useState } from 'react';
import { Bell, AlertTriangle, MapPin, Clock, CheckCheck, Trash2 } from 'lucide-react';
import { CrimeAlert } from '@/hooks/useCrimeAlerts';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
    case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    default: return 'bg-green-500/20 text-green-400 border-green-500/50';
  }
};

const formatTimeAgo = (timestamp: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

interface AlertItemProps {
  alert: CrimeAlert;
  onMarkRead: (id: string) => void;
}

function AlertItem({ alert, onMarkRead }: AlertItemProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all',
        alert.isRead 
          ? 'bg-secondary/30 border-border' 
          : 'bg-red-500/5 border-red-500/30 animate-pulse'
      )}
      onClick={() => !alert.isRead && onMarkRead(alert.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            'p-2 rounded-full',
            alert.severity === 'critical' && 'bg-red-500/20',
            alert.severity === 'high' && 'bg-orange-500/20',
            alert.severity === 'medium' && 'bg-yellow-500/20',
            alert.severity === 'low' && 'bg-green-500/20',
          )}>
            <AlertTriangle className={cn(
              'h-4 w-4',
              alert.severity === 'critical' && 'text-red-400',
              alert.severity === 'high' && 'text-orange-400',
              alert.severity === 'medium' && 'text-yellow-400',
              alert.severity === 'low' && 'text-green-400',
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm text-foreground truncate">
                {alert.incidentTitle}
              </h4>
              <Badge variant="outline" className={cn('text-[10px]', getSeverityColor(alert.severity))}>
                {alert.severity}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {alert.incidentType}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {alert.location}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimeAgo(alert.timestamp)}
              </span>
            </div>
            <div className="mt-2 p-2 rounded bg-secondary/50 border border-border">
              <p className="text-[10px] text-primary font-medium mb-1">
                ⚡ Matched Hotspot
              </p>
              <p className="text-xs text-foreground">
                {alert.matchedHotspot.zone} ({alert.matchedHotspot.distance}m away)
              </p>
              <p className="text-xs text-muted-foreground">
                Risk Score: {alert.matchedHotspot.riskScore}/100
              </p>
              <p className="text-[10px] text-muted-foreground">
                Radius: {alert.matchedHotspot.radiusMeters}m • Source: {alert.matchedHotspot.source}
              </p>
            </div>
          </div>
        </div>
        {!alert.isRead && (
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
    </div>
  );
}

interface CrimeAlertPanelProps {
  alerts: CrimeAlert[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAlerts: () => void;
}

export function CrimeAlertPanel({
  alerts,
  unreadCount,
  markAsRead,
  markAllAsRead,
  clearAlerts,
}: CrimeAlertPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Crime Alerts
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} new
                </Badge>
              )}
            </SheetTitle>
          </div>
          <SheetDescription>
            Real-time alerts when new incidents match predicted hotspot patterns
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 mt-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="flex-1"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAlerts}
            disabled={alerts.length === 0}
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-3 pr-4">
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No alerts yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Alerts will appear when incidents match hotspot patterns
                </p>
              </div>
            ) : (
              alerts.map(alert => (
                <AlertItem key={alert.id} alert={alert} onMarkRead={markAsRead} />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
