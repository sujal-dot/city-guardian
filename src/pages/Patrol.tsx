import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PatrolSuggestions } from '@/components/dashboard/PatrolSuggestions';
import { Button } from '@/components/ui/button';
import { Route, Users, Clock, Target, RefreshCw } from 'lucide-react';
import { PatrolRoutesMap } from '@/components/map/PatrolRoutesMap';
import { PatrolSuggestion, zoneCoordinates } from '@/data/mockData';

export default function Patrol() {
  const [selectedSuggestion, setSelectedSuggestion] = useState<PatrolSuggestion | null>(null);

  const routeStops = useMemo(() => {
    if (!selectedSuggestion) return undefined;
    const stops = selectedSuggestion.zones
      .map((zone) => {
        const coords = zoneCoordinates[zone];
        if (!coords) return null;
        return { name: zone, lat: coords.lat, lng: coords.lng };
      })
      .filter(Boolean) as { name: string; lat: number; lng: number }[];
    return stops.length > 0 ? stops : undefined;
  }, [selectedSuggestion]);

  const handleSelectSuggestion = (suggestion: PatrolSuggestion) => {
    setSelectedSuggestion((current) => (current?.id === suggestion.id ? null : suggestion));
  };

  return (
    <DashboardLayout
      title="AI Patrol Suggestions"
      subtitle="Optimized patrol routes and scheduling"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                <Route className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">12</p>
                <p className="text-sm text-muted-foreground">Active Routes</p>
              </div>
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-risk-safe/20">
                <Users className="h-6 w-6 text-risk-safe" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">48</p>
                <p className="text-sm text-muted-foreground">Officers Deployed</p>
              </div>
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-risk-high/20">
                <Clock className="h-6 w-6 text-risk-high" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">4.2h</p>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
              </div>
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">85%</p>
                <p className="text-sm text-muted-foreground">Coverage Rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Patrol Suggestions */}
        <PatrolSuggestions
          onSelectSuggestion={handleSelectSuggestion}
          selectedSuggestionId={selectedSuggestion?.id ?? null}
          onGenerateNew={() => setSelectedSuggestion(null)}
        />

        {/* Patrol Routes Map (from Heatmap high-risk zones) */}
        <PatrolRoutesMap
          routeStops={routeStops}
          routeLabel={selectedSuggestion?.route}
          routeWindow={selectedSuggestion ? `${selectedSuggestion.startTime} - ${selectedSuggestion.endTime}` : undefined}
          onClearRoute={() => setSelectedSuggestion(null)}
        />

        {/* Quick Actions */}
        <div className="flex justify-center gap-4">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate Routes
          </Button>
          <Button>
            <Route className="h-4 w-4 mr-2" />
            Deploy All Suggestions
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
