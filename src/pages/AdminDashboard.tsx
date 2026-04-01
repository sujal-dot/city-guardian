import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, FileText, Users, Bell, Loader2, MapPin, Clock, ExternalLink } from 'lucide-react';
import { useSOSAlerts } from '@/hooks/useSOSAlerts';
import { useAdminComplaints } from '@/hooks/useAdminComplaints';
import { useAdminIncidents } from '@/hooks/useAdminIncidents';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const AdminDashboard = () => {
  const { alerts, isLoading: alertsLoading, updateAlertStatus } = useSOSAlerts();
  const { complaints, isLoading: complaintsLoading, updateComplaintStatus } = useAdminComplaints();
  const { incidents, isLoading: incidentsLoading, updateIncident } = useAdminIncidents();
  const { toast } = useToast();

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const pendingComplaints = complaints.filter(c => c.status === 'pending');
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');

  const handleAlertStatusChange = async (alertId: string, status: string) => {
    try {
      await updateAlertStatus(alertId, status);
      toast({
        title: 'Alert Updated',
        description: `SOS alert status changed to ${status}`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update alert status',
        variant: 'destructive',
      });
    }
  };

  const handleComplaintStatusChange = async (complaintId: string, status: 'pending' | 'in_progress' | 'resolved' | 'closed') => {
    try {
      await updateComplaintStatus(complaintId, status);
      toast({
        title: 'Complaint Updated',
        description: `Complaint status changed to ${status}`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update complaint status',
        variant: 'destructive',
      });
    }
  };

  const handleIncidentUpdate = async (incidentId: string, updates: { status?: 'reported' | 'investigating' | 'resolved'; assigned_officer?: string }) => {
    try {
      await updateIncident(incidentId, updates);
      toast({
        title: 'Incident Updated',
        description: 'Incident details have been updated',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update incident',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
      case 'pending':
      case 'reported':
        return 'destructive';
      case 'in_progress':
      case 'responding':
        return 'secondary';
      case 'resolved':
      case 'closed':
        return 'outline';
      default:
        return 'default';
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'default';
    }
  };

  const getSourceBadgeClass = (source: string) => {
    switch (source) {
      case 'citizen':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'admin':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
      case 'system':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
    }
  };

  return (
    <DashboardLayout title="Admin Dashboard" subtitle="Manage incidents, complaints, and emergency alerts">
      <div className="space-y-6">

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active SOS Alerts</CardTitle>
              <Bell className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAlerts.length}</div>
              <p className="text-xs text-muted-foreground">Requires immediate attention</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Complaints</CardTitle>
              <FileText className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingComplaints.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeIncidents.length}</div>
              <p className="text-xs text-muted-foreground">Under investigation</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{complaints.length}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="sos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sos" className="relative">
              SOS Alerts
              {activeAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-xs text-destructive-foreground flex items-center justify-center">
                  {activeAlerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
          </TabsList>

          {/* SOS Alerts Tab */}
          <TabsContent value="sos">
            <Card>
              <CardHeader>
                <CardTitle>Emergency SOS Alerts</CardTitle>
                <CardDescription>Real-time emergency alerts from citizens</CardDescription>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : alerts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No SOS alerts</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id} className={alert.status === 'active' ? 'bg-destructive/10' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(alert.created_at), 'MMM dd, HH:mm')}
                            </div>
                          </TableCell>
                          <TableCell>
                            {alert.latitude !== null && alert.longitude !== null ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  {alert.latitude.toFixed(6)}, {alert.longitude.toFixed(6)}
                                </div>
                                <a
                                  href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  Open in Maps
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No location</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(alert.status)}>
                              {alert.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={alert.status}
                              onValueChange={(value) => handleAlertStatusChange(alert.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="responding">Responding</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Complaints Tab */}
          <TabsContent value="complaints">
            <Card>
              <CardHeader>
                <CardTitle>Citizen Complaints</CardTitle>
                <CardDescription>Review and manage citizen complaints</CardDescription>
              </CardHeader>
              <CardContent>
                {complaintsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : complaints.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No complaints</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {complaints.map((complaint) => (
                        <TableRow key={complaint.id}>
                          <TableCell>
                            {format(new Date(complaint.created_at), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{complaint.complaint_type}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {complaint.location_name}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {complaint.description}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(complaint.status)}>
                              {complaint.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={complaint.status}
                              onValueChange={(value: 'pending' | 'in_progress' | 'resolved' | 'closed') => 
                                handleComplaintStatusChange(complaint.id, value)
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Incidents Tab */}
          <TabsContent value="incidents">
            <Card>
              <CardHeader>
                <CardTitle>Incident Management</CardTitle>
                <CardDescription>Track and manage reported incidents</CardDescription>
              </CardHeader>
              <CardContent>
                {incidentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : incidents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No incidents</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incidents.map((incident) => (
                        <TableRow key={incident.id}>
                          <TableCell>
                            {format(new Date(incident.created_at), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="font-medium max-w-[150px] truncate">
                            {incident.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{incident.incident_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getSourceBadgeClass(incident.incident_source)}
                            >
                              {incident.reporter_label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getSeverityBadgeVariant(incident.severity)}>
                              {incident.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(incident.status)}>
                              {incident.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Officer name"
                              defaultValue={incident.assigned_officer || ''}
                              className="w-32"
                              onBlur={(e) => {
                                if (e.target.value !== incident.assigned_officer) {
                                  handleIncidentUpdate(incident.id, { assigned_officer: e.target.value });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={incident.status}
                              onValueChange={(value: 'reported' | 'investigating' | 'resolved') => 
                                handleIncidentUpdate(incident.id, { status: value })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="reported">Reported</SelectItem>
                                <SelectItem value="investigating">Investigating</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
