import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { IncidentTable } from '@/components/dashboard/IncidentTable';
import { CrimeTrendChart } from '@/components/dashboard/CrimeTrendChart';
import { HourlyPredictionChart } from '@/components/dashboard/HourlyPredictionChart';
import { RiskZoneList } from '@/components/dashboard/RiskZoneList';
import { EnhancedCrimeMap } from '@/components/map/EnhancedCrimeMap';
import { PatrolSuggestions } from '@/components/dashboard/PatrolSuggestions';
import { PredictionAccuracyChart } from '@/components/dashboard/PredictionAccuracyChart';
import { dashboardStats, incidents } from '@/data/mockData';
import { useSOSAlerts } from '@/hooks/useSOSAlerts';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Users, FileText, Brain } from 'lucide-react';

export default function Dashboard() {
  const [dbStats, setDbStats] = useState({
    activeIncidents: dashboardStats.activeIncidents,
    officersOnDuty: dashboardStats.officersOnDuty,
    openCases: dashboardStats.openCases,
  });
  const { alerts: sosAlerts, isLoading: sosAlertsLoading } = useSOSAlerts();
  const activeSOSAlerts = sosAlerts
    .filter((alert) => alert.status === 'active')
    .slice(0, 5);

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardStats = async () => {
      try {
        const [{ data: incidentRows, error: incidentsError }, { data: officerRows, error: officersError }] =
          await Promise.all([
            supabase.from('incidents').select('status'),
            supabase.from('user_roles').select('user_id').eq('role', 'police'),
          ]);

        if (incidentsError) throw incidentsError;
        if (officersError) throw officersError;
        if (!isMounted) return;

        const activeIncidents = (incidentRows || []).filter(
          (incident) => incident.status === 'reported' || incident.status === 'investigating'
        ).length;
        const openCases = (incidentRows || []).filter(
          (incident) => incident.status !== 'closed'
        ).length;
        const officersOnDuty = new Set((officerRows || []).map((row) => row.user_id)).size;

        setDbStats({
          activeIncidents,
          officersOnDuty,
          openCases,
        });
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      }
    };

    fetchDashboardStats();

    const incidentChannel = supabase
      .channel('dashboard_incident_stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents' },
        () => {
          fetchDashboardStats();
        }
      )
      .subscribe();

    const roleChannel = supabase
      .channel('dashboard_officer_stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => {
          fetchDashboardStats();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(incidentChannel);
      supabase.removeChannel(roleChannel);
    };
  }, []);

  const formatAlertTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Unknown time'
      : date.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
  };

  return (
    <DashboardLayout
      title="Command Center"
      subtitle="Thane City Crime Intelligence Dashboard"
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Incidents"
            value={dbStats.activeIncidents}
            icon={AlertTriangle}
            trend={12}
            trendLabel="vs last week"
            variant="danger"
          />
          <StatCard
            title="Officers on Duty"
            value={dbStats.officersOnDuty}
            icon={Users}
            trend={-5}
            trendLabel="shift change"
            variant="default"
          />
          <StatCard
            title="Open Cases"
            value={dbStats.openCases}
            icon={FileText}
            trend={8}
            trendLabel="new this week"
            variant="warning"
          />
          <StatCard
            title="Prediction Accuracy"
            value={`${dashboardStats.predictionAccuracy}%`}
            icon={Brain}
            trend={3}
            trendLabel="model improvement"
            variant="success"
          />
        </div>

        {/* Live SOS Alerts for Police Dashboard */}
        <div className="card-command overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Live SOS Alerts</h3>
              <p className="text-sm text-muted-foreground">Emergency alerts from citizens for police response</p>
            </div>
            <span className="badge-critical">{activeSOSAlerts.length} active</span>
          </div>
          <div className="p-4">
            {sosAlertsLoading ? (
              <p className="text-sm text-muted-foreground">Loading SOS alerts...</p>
            ) : activeSOSAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active SOS alerts right now.</p>
            ) : (
              <div className="space-y-2">
                {activeSOSAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg border border-risk-critical/40 bg-risk-critical/10 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">SOS Alert Active</p>
                      <p className="text-xs text-muted-foreground">
                        Location:{' '}
                        {alert.latitude !== null && alert.longitude !== null
                          ? `${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}`
                          : 'Location unavailable'}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatAlertTime(alert.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CrimeTrendChart />
          <HourlyPredictionChart />
        </div>

        {/* Interactive Heatmap */}
        <EnhancedCrimeMap />

        {/* Prediction Accuracy */}
        <PredictionAccuracyChart />

        {/* Incidents & Risk Scores */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <IncidentTable incidents={incidents} />
          </div>
          <RiskZoneList />
        </div>

        {/* Patrol Suggestions */}
        <PatrolSuggestions />
      </div>
    </DashboardLayout>
  );
}
