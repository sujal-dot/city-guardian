import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { IncidentTable } from '@/components/dashboard/IncidentTable';
import { CrimeTrendChart } from '@/components/dashboard/CrimeTrendChart';
import { HourlyPredictionChart } from '@/components/dashboard/HourlyPredictionChart';
import { RiskZoneList } from '@/components/dashboard/RiskZoneList';
import { CrimeMap } from '@/components/map/CrimeMap';
import { PatrolSuggestions } from '@/components/dashboard/PatrolSuggestions';
import { dashboardStats, incidents } from '@/data/mockData';
import { AlertTriangle, Users, FileText, Brain } from 'lucide-react';

export default function Dashboard() {
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
            value={dashboardStats.activeIncidents}
            icon={AlertTriangle}
            trend={12}
            trendLabel="vs last week"
            variant="danger"
          />
          <StatCard
            title="Officers on Duty"
            value={dashboardStats.officersOnDuty}
            icon={Users}
            trend={-5}
            trendLabel="shift change"
            variant="default"
          />
          <StatCard
            title="Open Cases"
            value={dashboardStats.openCases}
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

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CrimeTrendChart />
          <HourlyPredictionChart />
        </div>

        {/* Interactive Map */}
        <CrimeMap />

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
