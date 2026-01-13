import { complaints } from '@/data/mockData';
import { Clock, MapPin, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ComplaintTracker() {
  const statusStyles: Record<string, {
    icon: typeof Clock;
    bg: string;
    text: string;
    border: string;
    animate?: boolean;
  }> = {
    pending: {
      icon: Clock,
      bg: 'bg-risk-medium/10',
      text: 'text-risk-medium',
      border: 'border-risk-medium/30',
    },
    'in-progress': {
      icon: Loader2,
      bg: 'bg-primary/10',
      text: 'text-primary',
      border: 'border-primary/30',
      animate: true,
    },
    resolved: {
      icon: CheckCircle,
      bg: 'bg-risk-safe/10',
      text: 'text-risk-safe',
      border: 'border-risk-safe/30',
    },
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="card-command">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">My Complaints</h3>
        <p className="text-sm text-muted-foreground">Track your filed complaints</p>
      </div>
      <div className="p-4 space-y-3">
        {complaints.map((complaint, index) => {
          const status = statusStyles[complaint.status];
          const StatusIcon = status.icon;

          return (
            <div
              key={complaint.id}
              className={cn(
                'p-4 rounded-lg border transition-all hover:border-primary/50 animate-fade-in',
                status.bg,
                status.border
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {complaint.id}
                  </span>
                  <h4 className="text-base font-medium text-foreground">
                    {complaint.type}
                  </h4>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    status.bg,
                    status.text
                  )}
                >
                  <StatusIcon
                    className={cn('h-3.5 w-3.5', status.animate && 'animate-spin')}
                  />
                  <span className="capitalize">{complaint.status.replace('-', ' ')}</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {complaint.description}
              </p>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{complaint.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDate(complaint.timestamp)}</span>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="mt-4 flex items-center gap-2">
                <div
                  className={cn(
                    'flex-1 h-1 rounded-full',
                    complaint.status === 'pending'
                      ? 'bg-risk-medium'
                      : complaint.status === 'in-progress'
                      ? 'bg-primary'
                      : 'bg-risk-safe'
                  )}
                />
                <div
                  className={cn(
                    'flex-1 h-1 rounded-full',
                    complaint.status === 'in-progress'
                      ? 'bg-primary'
                      : complaint.status === 'resolved'
                      ? 'bg-risk-safe'
                      : 'bg-secondary'
                  )}
                />
                <div
                  className={cn(
                    'flex-1 h-1 rounded-full',
                    complaint.status === 'resolved' ? 'bg-risk-safe' : 'bg-secondary'
                  )}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Submitted</span>
                <span>In Review</span>
                <span>Resolved</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
