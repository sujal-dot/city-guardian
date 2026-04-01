import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { patrolSuggestions, PatrolSuggestion, zoneCoordinates } from '@/data/mockData';
import { Route, Clock, AlertCircle, ChevronRight, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

const OFFICER_FETCH_LIMIT = 200;
const FALLBACK_COORDINATES = { lat: 19.1891, lng: 72.9678 };
const DEFAULT_SUGGESTION_COUNT = patrolSuggestions.length;
const TIME_WINDOWS: Array<{ startTime: string; endTime: string }> = [
  { startTime: '18:00', endTime: '22:00' },
  { startTime: '20:00', endTime: '02:00' },
  { startTime: '06:00', endTime: '10:00' },
  { startTime: '12:00', endTime: '16:00' },
  { startTime: '22:00', endTime: '02:00' },
];
const CRIME_PATTERNS = [
  'assault',
  'robbery',
  'vehicle theft',
  'drug activity',
  'cyber fraud',
  'public disturbance',
];
const REASON_TEMPLATES = [
  'Peak {crime} alerts reported near {zone}',
  'Recent spike in {crime} cases around {zone}',
  'Preventive presence recommended for {zone} during active hours',
  'Crowd movement and commuter load increasing in {zone}',
];

interface OfficerCandidate {
  user_id: string;
  full_name: string;
}

const getBackendBaseCandidates = (baseUrl?: string) => {
  const candidates: string[] = [];
  if (!baseUrl) return candidates;

  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) return candidates;

  candidates.push(normalized);

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      candidates.push(parsed.toString().replace(/\/+$/, ''));
    } else if (parsed.hostname === '127.0.0.1') {
      parsed.hostname = 'localhost';
      candidates.push(parsed.toString().replace(/\/+$/, ''));
    }
  } catch {
    // Keep only the configured URL when parsing fails.
  }

  return Array.from(new Set(candidates));
};

const getRoleApiBaseCandidates = (baseUrl?: string) => {
  const directCandidates = getBackendBaseCandidates(baseUrl);
  if (import.meta.env.DEV) {
    return Array.from(new Set(['/api', ...directCandidates]));
  }
  return directCandidates;
};

const toUniqueOfficers = (officers: OfficerCandidate[]) =>
  Array.from(
    new Map(officers.map((officer) => [officer.user_id, officer])).values()
  );

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const mapPriorityToSeverity = (
  priority: PatrolSuggestion['priority']
): 'low' | 'medium' | 'high' => {
  if (priority === 'high') return 'high';
  if (priority === 'medium') return 'medium';
  return 'low';
};

const cloneSuggestions = (suggestions: PatrolSuggestion[]) =>
  suggestions.map((suggestion) => ({
    ...suggestion,
    zones: [...suggestion.zones],
  }));

const shuffleList = <T,>(values: T[]): T[] => {
  const list = [...values];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
  return list;
};

const generatePatrolSuggestions = (count = DEFAULT_SUGGESTION_COUNT): PatrolSuggestion[] => {
  const zonePool = shuffleList(Object.keys(zoneCoordinates));

  return Array.from({ length: count }, (_, index) => {
    const window = TIME_WINDOWS[
      (index + Math.floor(Math.random() * TIME_WINDOWS.length)) % TIME_WINDOWS.length
    ];
    const zoneCount = Math.random() < 0.7 ? 3 : 2;
    const zoneStart = (index * 2) % zonePool.length;
    let zones = Array.from({ length: zoneCount }, (_unused, offset) =>
      zonePool[(zoneStart + offset) % zonePool.length]
    );
    zones = Array.from(new Set(zones));

    if (zones.length < 2) {
      zones = [...(patrolSuggestions[index % patrolSuggestions.length]?.zones || [])].slice(0, 3);
    }

    const leadZone = zones[0] || 'city center';
    const crimePattern = CRIME_PATTERNS[Math.floor(Math.random() * CRIME_PATTERNS.length)];
    const reasonTemplate = REASON_TEMPLATES[Math.floor(Math.random() * REASON_TEMPLATES.length)];
    const reason = reasonTemplate
      .replace('{crime}', crimePattern)
      .replace('{zone}', leadZone);

    let priority: PatrolSuggestion['priority'] = 'low';
    if (index < 2) priority = 'high';
    else if (index < 4) priority = 'medium';

    return {
      id: `PS-${String(index + 1).padStart(3, '0')}`,
      route: zones.join(' → '),
      startTime: window.startTime,
      endTime: window.endTime,
      priority,
      reason,
      zones,
    };
  });
};

interface PatrolSuggestionsProps {
  onSelectSuggestion?: (suggestion: PatrolSuggestion) => void;
  selectedSuggestionId?: string | null;
  onGenerateNew?: () => void;
}

export function PatrolSuggestions({
  onSelectSuggestion,
  selectedSuggestionId,
  onGenerateNew,
}: PatrolSuggestionsProps) {
  const [travelModeById, setTravelModeById] = useState<Record<string, 'driving' | 'walking'>>({});
  const [isDeployingById, setIsDeployingById] = useState<Record<string, boolean>>({});
  const [assignedOfficerBySuggestion, setAssignedOfficerBySuggestion] = useState<Record<string, string>>({});
  const [officerPool, setOfficerPool] = useState<OfficerCandidate[] | null>(null);
  const [visibleSuggestions, setVisibleSuggestions] = useState<PatrolSuggestion[]>(
    () => cloneSuggestions(patrolSuggestions)
  );
  const { activeRole } = useAuthContext();
  const { toast } = useToast();
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  const backendCandidates = useMemo(
    () => getRoleApiBaseCandidates(backendUrl),
    [backendUrl]
  );

  const fetchPoliceOfficers = async (): Promise<OfficerCandidate[]> => {
    if (officerPool && officerPool.length > 0) {
      return officerPool;
    }

    for (const baseUrl of backendCandidates) {
      try {
        const params = new URLSearchParams({ limit: String(OFFICER_FETCH_LIMIT) });
        const response = await fetch(`${baseUrl}/admin/users-with-roles?${params.toString()}`);
        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
          continue;
        }

        const users = Array.isArray((responseData as { users?: unknown[] }).users)
          ? ((responseData as { users: unknown[] }).users as Array<{
              user_id?: string;
              full_name?: string | null;
              roles?: string[];
            }>)
          : [];

        const officersFromBackend = toUniqueOfficers(
          users
            .filter((user) => user.user_id && user.full_name && Array.isArray(user.roles) && user.roles.includes('police'))
            .map((user) => ({
              user_id: user.user_id as string,
              full_name: (user.full_name as string).trim(),
            }))
            .filter((officer) => officer.full_name.length > 0)
        );

        if (officersFromBackend.length > 0) {
          setOfficerPool(officersFromBackend);
          return officersFromBackend;
        }
      } catch {
        // Try direct Supabase fallback below.
      }
    }

    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'police')
      .limit(OFFICER_FETCH_LIMIT);

    if (!roleError && roleRows && roleRows.length > 0) {
      const userIds = Array.from(new Set(roleRows.map((role) => role.user_id)));
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesError) {
        throw profilesError;
      }

      const officersFromSupabase = toUniqueOfficers(
        (profiles || [])
          .filter((profile) => profile.full_name && profile.full_name.trim().length > 0)
          .map((profile) => ({
            user_id: profile.user_id,
            full_name: profile.full_name!.trim(),
          }))
      );

      if (officersFromSupabase.length > 0) {
        setOfficerPool(officersFromSupabase);
        return officersFromSupabase;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (roleError) {
        throw roleError;
      }
      return [];
    }

    const { data: ownProfile, error: ownProfileError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (ownProfileError) {
      throw ownProfileError;
    }

    if (ownProfile?.full_name && ownProfile.full_name.trim().length > 0) {
      const fallbackPool = [{
        user_id: ownProfile.user_id,
        full_name: ownProfile.full_name.trim(),
      }];
      setOfficerPool(fallbackPool);
      return fallbackPool;
    }

    return [];
  };

  const handleDeploy = (suggestion: PatrolSuggestion) => async (event: MouseEvent) => {
    event.stopPropagation();

    const alreadyAssigned = assignedOfficerBySuggestion[suggestion.id];
    if (alreadyAssigned) {
      toast({
        title: 'Already deployed',
        description: `${suggestion.id} is already assigned to ${alreadyAssigned}.`,
      });
      return;
    }

    setIsDeployingById((current) => ({ ...current, [suggestion.id]: true }));

    try {
      const officers = await fetchPoliceOfficers();
      if (officers.length === 0) {
        throw new Error('No police officers with names were found in the database.');
      }

      const assignedOfficer = officers[hashString(suggestion.id) % officers.length];
      const primaryZone = suggestion.zones.find(Boolean) ?? suggestion.route;
      const coordinates = zoneCoordinates[primaryZone] ?? FALLBACK_COORDINATES;
      const { data: { user } } = await supabase.auth.getUser();

      const incidentPayload = {
        title: `Patrol Deployment ${suggestion.id}`,
        incident_type: 'Patrol Deployment',
        severity: mapPriorityToSeverity(suggestion.priority),
        status: 'investigating' as const,
        location_name: primaryZone,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        description: [
          `AI patrol route: ${suggestion.route}`,
          `Schedule: ${suggestion.startTime} - ${suggestion.endTime}`,
          `Reason: ${suggestion.reason}`,
        ].join(' | '),
        assigned_officer: assignedOfficer.full_name,
        reported_by: user?.id ?? null,
        incident_source: user ? (activeRole === 'admin' ? 'admin' : 'police') : 'system',
      };

      let createdByBackend = false;
      let backendError: string | null = null;

      for (const baseUrl of backendCandidates) {
        try {
          const response = await fetch(`${baseUrl}/incidents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(incidentPayload),
          });
          const responseData = await response.json().catch(() => ({}));
          if (!response.ok) {
            backendError =
              (responseData as { error?: string })?.error || `Backend returned ${response.status}`;
            continue;
          }
          createdByBackend = true;
          backendError = null;
          break;
        } catch (error) {
          // Preserve a meaningful backend error (e.g. validation/schema issue) if we already have one.
          if (!backendError) {
            backendError = error instanceof Error ? error.message : 'Failed to reach backend.';
          }
        }
      }

      if (!createdByBackend) {
        if (!user) {
          throw new Error(
            backendError
              ? `Deployment backend error: ${backendError}`
              : 'Please sign in or start the backend server to create deployments.'
          );
        }

        const { error: insertError } = await supabase
          .from('incidents')
          .insert(incidentPayload);

        if (insertError) {
          throw insertError;
        }
      }

      setAssignedOfficerBySuggestion((current) => ({
        ...current,
        [suggestion.id]: assignedOfficer.full_name,
      }));

      toast({
        title: 'Patrol deployed',
        description: `${suggestion.id} assigned to ${assignedOfficer.full_name}.`,
      });
    } catch (error) {
      toast({
        title: 'Deploy failed',
        description: error instanceof Error ? error.message : 'Unable to deploy this patrol suggestion.',
        variant: 'destructive',
      });
    } finally {
      setIsDeployingById((current) => ({ ...current, [suggestion.id]: false }));
    }
  };

  const priorityStyles = {
    high: 'border-l-risk-critical bg-risk-critical/5',
    medium: 'border-l-risk-high bg-risk-high/5',
    low: 'border-l-risk-medium bg-risk-medium/5',
  };

  const priorityBadge = {
    high: 'badge-critical',
    medium: 'badge-high',
    low: 'badge-medium',
  };

  const handleGenerateNew = () => {
    const nextSuggestions = generatePatrolSuggestions(DEFAULT_SUGGESTION_COUNT);
    setVisibleSuggestions(nextSuggestions);
    setTravelModeById({});
    setIsDeployingById({});
    setAssignedOfficerBySuggestion({});
    onGenerateNew?.();
    toast({
      title: 'Suggestions regenerated',
      description: `Generated ${nextSuggestions.length} new patrol routes.`,
    });
  };

  return (
    <div className="card-command">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Route className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">AI Patrol Suggestions</h3>
            <p className="text-sm text-muted-foreground">Optimized patrol routes based on predictions</p>
            <p className="text-xs text-muted-foreground">
              Tip: choose driving or walking per suggestion; Google Maps opens in the same tab.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleGenerateNew}>
          Generate New
        </Button>
      </div>
      <div className="p-4 space-y-3">
        {visibleSuggestions.map((suggestion, index) => {
          const isSelected = selectedSuggestionId === suggestion.id;
          const isSelectable = Boolean(onSelectSuggestion);
          const zoneNames = suggestion.zones.filter(Boolean);
          const canOpenMaps = zoneNames.length >= 2;
          const travelMode = travelModeById[suggestion.id] ?? 'driving';
          const isDeploying = Boolean(isDeployingById[suggestion.id]);
          const assignedOfficer = assignedOfficerBySuggestion[suggestion.id];
          const handleOpenMaps = (event: MouseEvent) => {
            event.stopPropagation();
            if (!canOpenMaps) return;
            // Build a Google Maps directions URL using place names and same-tab navigation.
            const formatPlace = (zone: string) => `${zone}, Thane, Maharashtra, India`;
            const [origin, ...rest] = zoneNames.map(formatPlace);
            const destination = rest[rest.length - 1];
            const waypoints = rest.slice(0, -1);
            const params = new URLSearchParams({
              api: '1',
              origin,
              destination,
              travelmode: travelMode,
            });
            if (waypoints.length > 0) {
              params.set(
                'waypoints',
                waypoints.join('|')
              );
            }
            const url = `https://www.google.com/maps/dir/?${params.toString()}`;
            window.location.assign(url);
          };
          const handleSetMode = (mode: 'driving' | 'walking') => (event: MouseEvent) => {
            event.stopPropagation();
            setTravelModeById((current) => ({ ...current, [suggestion.id]: mode }));
          };
          return (
            <div
              key={suggestion.id}
              className={cn(
                'p-4 rounded-lg border-l-4 border border-border transition-all hover:border-primary/50 animate-fade-in',
                priorityStyles[suggestion.priority],
                isSelectable && 'cursor-pointer',
                isSelected && 'border-primary/60 ring-1 ring-primary/20 bg-primary/5'
              )}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => onSelectSuggestion?.(suggestion)}
              role={isSelectable ? 'button' : undefined}
              aria-pressed={isSelectable ? isSelected : undefined}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{suggestion.id}</span>
                  <span className={priorityBadge[suggestion.priority]}>
                    {suggestion.priority} priority
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{suggestion.startTime} - {suggestion.endTime}</span>
                </div>
              </div>

              <h4 className="text-base font-medium text-foreground mb-2 flex items-center gap-2">
                <Route className="h-4 w-4 text-primary" />
                {suggestion.route}
              </h4>

              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <AlertCircle className="h-4 w-4 text-risk-high" />
                <span>{suggestion.reason}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="flex gap-1">
                    {suggestion.zones.map((zone) => (
                      <span
                        key={zone}
                        className="px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground"
                      >
                        {zone}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant={travelMode === 'driving' ? 'default' : 'outline'}
                        size="sm"
                        onClick={handleSetMode('driving')}
                      >
                        Driving
                      </Button>
                      <Button
                        variant={travelMode === 'walking' ? 'default' : 'outline'}
                        size="sm"
                        onClick={handleSetMode('walking')}
                      >
                        Walking
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canOpenMaps}
                      onClick={handleOpenMaps}
                    >
                      Open in Google Maps
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary"
                      disabled={isDeploying || Boolean(assignedOfficer)}
                      onClick={handleDeploy(suggestion)}
                    >
                      {isDeploying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Deploying
                        </>
                      ) : (
                        <>
                          {assignedOfficer ? 'Deployed' : 'Deploy'}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                  {assignedOfficer ? (
                    <p className="text-[11px] text-primary">
                      Assigned to {assignedOfficer}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    Opens in the same tab • travel mode is per suggestion
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
