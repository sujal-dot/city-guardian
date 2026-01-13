import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RiskZoneList } from '@/components/dashboard/RiskZoneList';
import { zoneRiskScores } from '@/data/mockData';
import { Shield, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RiskScoring() {
  const getRiskLevel = (score: number) => {
    if (score >= 70) return { label: 'Critical', color: 'text-risk-critical', bg: 'bg-risk-critical' };
    if (score >= 50) return { label: 'High', color: 'text-risk-high', bg: 'bg-risk-high' };
    if (score >= 30) return { label: 'Medium', color: 'text-risk-medium', bg: 'bg-risk-medium' };
    return { label: 'Low', color: 'text-risk-low', bg: 'bg-risk-low' };
  };

  const averageScore = Math.round(
    zoneRiskScores.reduce((acc, zone) => acc + zone.score, 0) / zoneRiskScores.length
  );

  const highRiskZones = zoneRiskScores.filter((z) => z.score >= 50).length;

  return (
    <DashboardLayout
      title="Risk Scoring"
      subtitle="Dynamic risk assessment for all zones"
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">City Average Risk</p>
                <p className={cn('text-3xl font-bold', getRiskLevel(averageScore).color)}>
                  {averageScore}
                </p>
              </div>
              <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', getRiskLevel(averageScore).bg + '/20')}>
                <Shield className={cn('h-8 w-8', getRiskLevel(averageScore).color)} />
              </div>
            </div>
            <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', getRiskLevel(averageScore).bg)}
                style={{ width: `${averageScore}%` }}
              />
            </div>
          </div>

          <div className="card-stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">High-Risk Zones</p>
                <p className="text-3xl font-bold text-risk-high">{highRiskZones}</p>
              </div>
              <div className="h-16 w-16 rounded-full flex items-center justify-center bg-risk-high/20">
                <AlertCircle className="h-8 w-8 text-risk-high" />
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              out of {zoneRiskScores.length} monitored zones
            </p>
          </div>

          <div className="card-stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Trend (7 days)</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-risk-critical">+5%</p>
                  <TrendingUp className="h-6 w-6 text-risk-critical" />
                </div>
              </div>
              <div className="h-16 w-16 rounded-full flex items-center justify-center bg-risk-critical/20">
                <TrendingUp className="h-8 w-8 text-risk-critical" />
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Overall risk increase
            </p>
          </div>
        </div>

        {/* Risk Factors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RiskZoneList />

          <div className="card-command p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Risk Scoring Factors</h3>
            <div className="space-y-4">
              {[
                { factor: 'Historical Crime Data', weight: 30, description: 'Past incident frequency' },
                { factor: 'Time-based Patterns', weight: 25, description: 'Peak crime hours analysis' },
                { factor: 'Population Density', weight: 20, description: 'Area demographics' },
                { factor: 'Complaint Frequency', weight: 15, description: 'Recent citizen reports' },
                { factor: 'Environmental Factors', weight: 10, description: 'Lighting, infrastructure' },
              ].map((item) => (
                <div key={item.factor} className="p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{item.factor}</span>
                    <span className="text-sm font-mono text-primary">{item.weight}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${item.weight}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
