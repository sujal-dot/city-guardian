import { Incident } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { MapPin, Clock, User, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IncidentTableProps {
  incidents: Incident[];
}

const riskBadgeClass = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
};

const statusStyles = {
  active: 'bg-risk-critical/20 text-risk-critical border-risk-critical/30',
  investigating: 'bg-risk-high/20 text-risk-high border-risk-high/30',
  resolved: 'bg-risk-safe/20 text-risk-safe border-risk-safe/30',
};

export function IncidentTable({ incidents }: IncidentTableProps) {
  const formatIncidentId = (id: string) => {
    if (id.startsWith('INC-')) {
      return id;
    }
    return `INC-${id.slice(0, 8).toUpperCase()}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="card-command overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent Incidents</h3>
          <p className="text-sm text-muted-foreground">Real-time incident monitoring</p>
        </div>
        <Button variant="ghost" size="sm" className="text-primary">
          View All
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="table-command">
          <thead>
            <tr className="bg-secondary/30">
              <th>Incident ID</th>
              <th>Type</th>
              <th>Location</th>
              <th>Time</th>
              <th>Risk Level</th>
              <th>Status</th>
              <th>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id} className="hover:bg-secondary/20 cursor-pointer transition-colors">
                <td>
                  <span className="font-mono text-sm text-primary">{formatIncidentId(incident.id)}</span>
                </td>
                <td>
                  <span className="font-medium">{incident.type}</span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{incident.location}</span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <span className="text-foreground">{formatTime(incident.timestamp)}</span>
                      <span className="text-muted-foreground ml-1">{formatDate(incident.timestamp)}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={riskBadgeClass[incident.riskLevel]}>
                    {incident.riskLevel}
                  </span>
                </td>
                <td>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border capitalize',
                      statusStyles[incident.status]
                    )}
                  >
                    {incident.status}
                  </span>
                </td>
                <td>
                  {incident.assignedOfficer ? (
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm truncate max-w-[120px]">
                        {incident.assignedOfficer}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Unassigned</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {incidents.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No incidents reported yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
