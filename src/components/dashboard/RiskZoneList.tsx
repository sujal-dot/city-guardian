import { zoneRiskScores } from '@/data/mockData';
import { TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RiskZoneList() {
  const getRiskColor = (score: number) => {
    if (score >= 70) return 'bg-risk-critical';
    if (score >= 50) return 'bg-risk-high';
    if (score >= 30) return 'bg-risk-medium';
    return 'bg-risk-low';
  };

  const getRiskTextColor = (score: number) => {
    if (score >= 70) return 'text-risk-critical';
    if (score >= 50) return 'text-risk-high';
    if (score >= 30) return 'text-risk-medium';
    return 'text-risk-low';
  };

  return (
    <div className="card-command p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Zone Risk Scores</h3>
        <p className="text-sm text-muted-foreground">AI-calculated risk assessment</p>
      </div>
      <div className="space-y-4">
        {zoneRiskScores.map((zone, index) => (
          <div
            key={zone.zone}
            className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-secondary">
              <MapPin className={cn('h-4 w-4', getRiskTextColor(zone.score))} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{zone.zone}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', getRiskColor(zone.score))}
                    style={{ width: `${zone.score}%` }}
                  />
                </div>
                <span className={cn('text-sm font-mono font-medium', getRiskTextColor(zone.score))}>
                  {zone.score}
                </span>
              </div>
            </div>
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
                zone.change > 0 && 'bg-risk-critical/10 text-risk-critical',
                zone.change < 0 && 'bg-risk-safe/10 text-risk-safe',
                zone.change === 0 && 'bg-muted text-muted-foreground'
              )}
            >
              {zone.change > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : zone.change < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              <span>{zone.change > 0 ? '+' : ''}{zone.change}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
