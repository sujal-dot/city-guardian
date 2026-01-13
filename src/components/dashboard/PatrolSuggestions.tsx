import { patrolSuggestions } from '@/data/mockData';
import { Route, Clock, AlertCircle, ChevronRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PatrolSuggestions() {
  const priorityStyles = {
    high: 'border-l-risk-critical bg-risk-critical/5',
    medium: 'border-l-risk-high bg-risk-high/5',
    low: 'border-l-risk-medium bg-risk-medium/5',
  };

  const priorityBadge = {
    high: 'badge-critical',
    medium: 'badge-high',
    low: 'badge-medium',
  };

  return (
    <div className="card-command">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Route className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">AI Patrol Suggestions</h3>
            <p className="text-sm text-muted-foreground">Optimized patrol routes based on predictions</p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          Generate New
        </Button>
      </div>
      <div className="p-4 space-y-3">
        {patrolSuggestions.map((suggestion, index) => (
          <div
            key={suggestion.id}
            className={cn(
              'p-4 rounded-lg border-l-4 border border-border transition-all hover:border-primary/50 cursor-pointer animate-fade-in',
              priorityStyles[suggestion.priority]
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{suggestion.id}</span>
                <span className={priorityBadge[suggestion.priority]}>
                  {suggestion.priority} priority
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{suggestion.startTime} - {suggestion.endTime}</span>
              </div>
            </div>

            <h4 className="text-base font-medium text-foreground mb-2 flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              {suggestion.route}
            </h4>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <AlertCircle className="h-4 w-4 text-risk-high" />
              <span>{suggestion.reason}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div className="flex gap-1">
                  {suggestion.zones.map((zone) => (
                    <span
                      key={zone}
                      className="px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground"
                    >
                      {zone}
                    </span>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-primary">
                Deploy
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
