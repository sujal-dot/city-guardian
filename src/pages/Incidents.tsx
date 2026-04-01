import { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { IncidentTable } from '@/components/dashboard/IncidentTable';
import { Incident as IncidentUi } from '@/data/mockData';
import { useIncidents } from '@/hooks/useIncidents';
import { NewIncidentDialog } from '@/components/incidents/NewIncidentDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Download } from 'lucide-react';

export default function Incidents() {
  const { incidents, isLoading, error, refetch } = useIncidents();

  const mappedIncidents = useMemo<IncidentUi[]>(
    () =>
      incidents.map((incident) => ({
        id: incident.id,
        type: incident.incident_type,
        location: incident.location_name,
        coordinates: {
          lat: Number(incident.latitude),
          lng: Number(incident.longitude),
        },
        timestamp: incident.created_at,
        status:
          incident.status === 'reported'
            ? 'active'
            : incident.status === 'closed'
            ? 'resolved'
            : incident.status,
        riskLevel: incident.severity,
        description: incident.description || '',
        assignedOfficer: incident.assigned_officer || undefined,
      })),
    [incidents]
  );

  return (
    <DashboardLayout
      title="Incident Management"
      subtitle="View and manage all reported incidents"
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-3 w-full md:w-auto">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search incidents..."
                className="pl-9 bg-secondary/50"
              />
            </div>
            <Select>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <NewIncidentDialog onCreated={refetch} />
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load incidents: {error}
          </div>
        ) : null}

        {/* Incidents Table */}
        {isLoading && mappedIncidents.length === 0 ? (
          <div className="card-command p-6 text-sm text-muted-foreground">
            Loading incidents...
          </div>
        ) : (
          <IncidentTable incidents={mappedIncidents} />
        )}
      </div>
    </DashboardLayout>
  );
}
