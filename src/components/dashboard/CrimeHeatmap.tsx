import { crimeHotspots } from '@/data/mockData';
import { MapPin, AlertTriangle, Clock, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CrimeHeatmap() {
  const getZoneClass = (score: number) => {
    if (score >= 70) return 'zone-critical';
    if (score >= 50) return 'zone-high';
    if (score >= 30) return 'zone-medium';
    return 'zone-safe';
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) return 'badge-critical';
    if (score >= 50) return 'badge-high';
    if (score >= 30) return 'badge-medium';
    return 'badge-low';
  };

  return (
    <div className="card-command overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Crime Heatmap</h3>
          <p className="text-sm text-muted-foreground">Thane City - Live Hotspot Visualization</p>
        </div>
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">Real-time tracking</span>
        </div>
      </div>

      {/* Map Visualization */}
      <div className="relative h-[400px] bg-secondary/30 overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 grid-pattern opacity-50" />

        {/* Thane City Outline (Stylized) */}
        <svg
          viewBox="0 0 400 300"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* City boundary */}
          <path
            d="M50 80 L120 50 L200 40 L280 55 L340 90 L360 160 L350 220 L300 260 L220 270 L140 265 L70 230 L40 170 Z"
            fill="none"
            stroke="hsl(217, 91%, 60%)"
            strokeWidth="2"
            strokeDasharray="5 5"
            opacity="0.5"
          />

          {/* Major roads */}
          <line x1="50" y1="150" x2="350" y2="150" stroke="hsl(215, 28%, 30%)" strokeWidth="3" />
          <line x1="200" y1="40" x2="200" y2="270" stroke="hsl(215, 28%, 30%)" strokeWidth="3" />
          <line x1="80" y1="80" x2="320" y2="220" stroke="hsl(215, 28%, 25%)" strokeWidth="2" />
        </svg>

        {/* Hotspot Markers */}
        {crimeHotspots.map((hotspot, index) => {
          const x = 80 + index * 70;
          const y = 100 + (index % 2 === 0 ? 50 : 120);

          return (
            <div
              key={hotspot.id}
              className={cn(
                'absolute w-32 h-32 -translate-x-1/2 -translate-y-1/2 pointer-events-none',
                getZoneClass(hotspot.riskScore)
              )}
              style={{ left: x, top: y }}
            >
              {/* Pulse effect */}
              <div className="absolute inset-0 rounded-full animate-pulse-ring opacity-30" />
            </div>
          );
        })}

        {/* Hotspot Labels */}
        {crimeHotspots.map((hotspot, index) => {
          const x = 80 + index * 70;
          const y = 100 + (index % 2 === 0 ? 50 : 120);

          return (
            <div
              key={`label-${hotspot.id}`}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: x, top: y }}
            >
              <div className="flex flex-col items-center gap-1 cursor-pointer group">
                <div className="p-2 rounded-full bg-background border border-border group-hover:border-primary transition-colors">
                  <MapPin className={cn('h-4 w-4', hotspot.riskScore >= 70 ? 'text-risk-critical' : hotspot.riskScore >= 50 ? 'text-risk-high' : 'text-risk-medium')} />
                </div>
                <div className="glass px-2 py-1 rounded text-xs font-medium text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {hotspot.zone}
                </div>
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 glass p-3 rounded-lg">
          <p className="text-xs font-medium text-foreground mb-2">Risk Levels</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-risk-critical" />
              <span className="text-xs text-muted-foreground">Critical (&gt;70)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-risk-high" />
              <span className="text-xs text-muted-foreground">High (50-70)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-risk-medium" />
              <span className="text-xs text-muted-foreground">Medium (30-50)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-risk-safe" />
              <span className="text-xs text-muted-foreground">Safe (&lt;30)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hotspot Details */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {crimeHotspots.map((hotspot) => (
          <div
            key={`detail-${hotspot.id}`}
            className="p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-sm font-medium text-foreground">{hotspot.zone}</h4>
              <span className={getRiskBadge(hotspot.riskScore)}>{hotspot.riskScore}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                <span>{hotspot.predictedCrimes} predicted incidents</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Peak: {hotspot.timeWindow}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {hotspot.crimeTypes.slice(0, 2).map((type) => (
                <span
                  key={type}
                  className="px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
