import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HourlyPredictionChart } from '@/components/dashboard/HourlyPredictionChart';
import { CrimeTrendChart } from '@/components/dashboard/CrimeTrendChart';
import { crimeHotspots } from '@/data/mockData';
import { Brain, TrendingUp, Target, AlertTriangle, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CrimePrediction() {
  return (
    <DashboardLayout
      title="Crime Prediction"
      subtitle="AI-powered crime forecasting and analysis"
    >
      <div className="space-y-6">
        {/* AI Model Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">87.5%</p>
                <p className="text-sm text-muted-foreground">Model Accuracy</p>
              </div>
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-risk-high/20">
                <TrendingUp className="h-6 w-6 text-risk-high" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">28</p>
                <p className="text-sm text-muted-foreground">Predicted (24h)</p>
              </div>
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-risk-critical/20">
                <AlertTriangle className="h-6 w-6 text-risk-critical" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">4</p>
                <p className="text-sm text-muted-foreground">High-Risk Zones</p>
              </div>
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-risk-safe/20">
                <Target className="h-6 w-6 text-risk-safe" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">92%</p>
                <p className="text-sm text-muted-foreground">Prevention Rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <HourlyPredictionChart />
          <CrimeTrendChart />
        </div>

        {/* Predicted Hotspots */}
        <div className="card-command">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">Predicted Hotspots (Next 24 Hours)</h3>
            <p className="text-sm text-muted-foreground">AI-detected high-risk areas requiring attention</p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {crimeHotspots.map((hotspot, index) => {
              const getRiskClass = (score: number) => {
                if (score >= 70) return 'border-l-risk-critical bg-risk-critical/5';
                if (score >= 50) return 'border-l-risk-high bg-risk-high/5';
                return 'border-l-risk-medium bg-risk-medium/5';
              };

              const getRiskBadge = (score: number) => {
                if (score >= 70) return 'badge-critical';
                if (score >= 50) return 'badge-high';
                return 'badge-medium';
              };

              return (
                <div
                  key={hotspot.id}
                  className={cn(
                    'p-4 rounded-lg border-l-4 border border-border animate-fade-in',
                    getRiskClass(hotspot.riskScore)
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <h4 className="font-medium text-foreground">{hotspot.zone}</h4>
                    </div>
                    <span className={getRiskBadge(hotspot.riskScore)}>
                      Score: {hotspot.riskScore}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{hotspot.predictedCrimes} predicted incidents</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Peak hours: {hotspot.timeWindow}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {hotspot.crimeTypes.map((type) => (
                      <span
                        key={type}
                        className="px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
