import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ComplaintStatus = 'Pending' | 'In Progress' | 'Resolved' | 'Rejected';
type ComplaintFilter = 'all' | 'Pending' | 'In Progress' | 'Resolved';

interface Complaint {
  complaint_id: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  created_at: string | null;
  file_url: string | null;
}

const STATUS_BADGE_STYLES: Record<ComplaintStatus, string> = {
  Pending: 'bg-amber-500/15 text-amber-300 border-amber-400/35',
  'In Progress': 'bg-blue-500/15 text-blue-300 border-blue-400/35',
  Resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35',
  Rejected: 'bg-red-500/15 text-red-300 border-red-400/35',
};

const STEP_COLORS: Record<'Pending' | 'In Progress' | 'Resolved', string> = {
  Pending: 'bg-amber-400',
  'In Progress': 'bg-blue-500',
  Resolved: 'bg-emerald-500',
};

const PROGRESS_STEPS: Array<'Pending' | 'In Progress' | 'Resolved'> = [
  'Pending',
  'In Progress',
  'Resolved',
];

const normalizeStatus = (value: unknown): ComplaintStatus => {
  const normalized = String(value ?? 'pending').trim().toLowerCase().replace(/_/g, ' ');
  if (normalized === 'in progress') return 'In Progress';
  if (normalized === 'resolved') return 'Resolved';
  if (normalized === 'rejected' || normalized === 'closed') return 'Rejected';
  return 'Pending';
};

const normalizeApiBase = (value: string) => {
  const normalized = value.trim().replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

const addLocalhostVariant = (baseUrl: string) => {
  const candidates = [baseUrl];
  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      candidates.push(parsed.toString().replace(/\/+$/, ''));
    } else if (parsed.hostname === '127.0.0.1') {
      parsed.hostname = 'localhost';
      candidates.push(parsed.toString().replace(/\/+$/, ''));
    }
  } catch {
    // Keep only the original base URL when URL parsing fails.
  }
  return candidates;
};

const buildApiCandidates = (complaintsApiUrl?: string, backendUrl?: string): string[] => {
  const rawBases = [
    complaintsApiUrl?.trim() ? normalizeApiBase(complaintsApiUrl) : null,
    backendUrl?.trim() ? normalizeApiBase(backendUrl) : null,
    'http://localhost:5001/api',
  ].filter(Boolean) as string[];

  if (import.meta.env.DEV) {
    rawBases.push('/api');
  }

  const expanded = rawBases.flatMap((baseUrl) => addLocalhostVariant(baseUrl));
  return Array.from(new Set(expanded));
};

const toSafeString = (value: unknown, fallback = '') => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const normalizeComplaint = (value: unknown): Complaint => {
  const raw = (value || {}) as Record<string, unknown>;

  return {
    complaint_id: toSafeString(raw.complaint_id || raw.id || raw._id || 'N/A', 'N/A'),
    title: toSafeString(raw.title || raw.complaint_type || 'Untitled Complaint', 'Untitled Complaint'),
    description: toSafeString(raw.description),
    status: normalizeStatus(raw.status),
    created_at: raw.created_at ? toSafeString(raw.created_at) : null,
    file_url: raw.file_url ? toSafeString(raw.file_url) : null,
  };
};

const formatDate = (timestamp: string | null) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getEvidenceType = (url: string) => {
  const normalized = url.toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v)$/.test(normalized)) {
    return 'video';
  }
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(normalized)) {
    return 'image';
  }
  return 'unknown';
};

export function TrackComplaints() {
  const { user, session, effectiveRoles, isLoading: isAuthLoading } = useAuthContext();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ComplaintFilter>('all');
  const [previewComplaint, setPreviewComplaint] = useState<Complaint | null>(null);

  const complaintsApiUrl = import.meta.env.VITE_COMPLAINTS_API_URL as string | undefined;
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  const apiCandidates = useMemo(
    () => buildApiCandidates(complaintsApiUrl, backendUrl),
    [backendUrl, complaintsApiUrl]
  );
  const userId = user?.id || session?.user?.id || null;
  const isCitizenRole = effectiveRoles.includes('citizen');

  const fetchComplaintsFromSupabase = useCallback(async () => {
    const baseQuery = supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });

    const query = userId ? baseQuery.eq('user_id', userId) : baseQuery;
    const { data, error: fetchError } = await query;
    if (fetchError) {
      throw fetchError;
    }

    const normalizedData = (data || []).map((item) =>
      normalizeComplaint({
        complaint_id: item.id,
        title: item.complaint_type,
        description: item.description,
        status: item.status,
        created_at: item.created_at,
        file_url: item.file_url,
      })
    );

    return normalizedData;
  }, [userId]);

  const fetchComplaints = useCallback(async () => {
    if (!userId && !isCitizenRole) {
      setComplaints([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    let lastError = 'Failed to fetch complaints.';
    let apiCompleted = false;

    if (userId) {
      for (const apiBase of apiCandidates) {
        try {
          const response = await fetch(`${apiBase}/complaints/user/${encodeURIComponent(userId)}`);
          const responseBody = await response.json().catch(() => ({}));

          if (!response.ok) {
            lastError =
              (responseBody as { error?: string })?.error || `Backend returned ${response.status}.`;
            continue;
          }

          apiCompleted = true;
          const data = Array.isArray((responseBody as { complaints?: unknown[] })?.complaints)
            ? (responseBody as { complaints: unknown[] }).complaints
            : [];

          const normalizedComplaints = data.map((item) => normalizeComplaint(item));
          setComplaints(normalizedComplaints);
          setError(null);
          setIsLoading(false);
          return;
        } catch (fetchError) {
          lastError =
            fetchError instanceof Error ? fetchError.message : 'Unable to reach complaints backend.';
        }
      }
    }

    try {
      const supabaseComplaints = await fetchComplaintsFromSupabase();
      setComplaints(supabaseComplaints);
      setError(null);
      setIsLoading(false);
      return;
    } catch (supabaseError) {
      const supabaseMessage =
        supabaseError instanceof Error ? supabaseError.message : 'Failed to fetch complaints from Supabase.';
      lastError = apiCompleted ? supabaseMessage : `${lastError} ${supabaseMessage}`;
    }

    setComplaints([]);
    setError(lastError);
    setIsLoading(false);
  }, [apiCandidates, fetchComplaintsFromSupabase, isCitizenRole, userId]);

  useEffect(() => {
    void fetchComplaints();
  }, [fetchComplaints]);

  const filteredComplaints = useMemo(() => {
    if (filter === 'all') return complaints;
    return complaints.filter((complaint) => complaint.status === filter);
  }, [complaints, filter]);

  if (isAuthLoading) {
    return (
      <div className="card-command p-6">
        <Skeleton className="h-8 w-56 mb-4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!userId && !isCitizenRole) {
    return (
      <div className="card-command p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-foreground font-medium">Sign in to track your complaints</p>
        <p className="text-sm text-muted-foreground mt-1">
          Complaint history is available for logged-in citizens.
        </p>
      </div>
    );
  }

  return (
    <div className="card-command p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-foreground">Track Complaints</h3>
          <p className="text-sm text-muted-foreground">
            Monitor your complaint status and evidence updates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(value) => setFilter(value as ComplaintFilter)}>
            <SelectTrigger className="w-[170px] bg-secondary/70">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void fetchComplaints()} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-40 w-full" />
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive font-medium">Unable to load complaints</p>
          <p className="text-xs text-destructive/90 mt-1">{error}</p>
        </div>
      ) : null}

      {!isLoading && !error && filteredComplaints.length === 0 ? (
        <div className="rounded-lg border border-border bg-secondary/30 p-10 text-center">
          <AlertCircle className="h-11 w-11 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No complaints filed yet</p>
        </div>
      ) : null}

      {!isLoading && !error && filteredComplaints.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredComplaints.map((complaint) => {
            const currentStepIndex = PROGRESS_STEPS.indexOf(
              complaint.status as (typeof PROGRESS_STEPS)[number]
            );
            const isRejected = complaint.status === 'Rejected';

            return (
              <div
                key={complaint.complaint_id}
                className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-5 backdrop-blur-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <h4 className="text-base font-semibold text-slate-100">{complaint.title}</h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <div className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        <span>Complaint ID: {complaint.complaint_id}</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>Date: {formatDate(complaint.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                        STATUS_BADGE_STYLES[complaint.status]
                      )}
                    >
                      {complaint.status}
                    </span>

                    {complaint.file_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-100"
                        onClick={() => setPreviewComplaint(complaint)}
                      >
                        <Eye className="h-4 w-4 mr-1.5" />
                        View Evidence
                      </Button>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 text-sm text-slate-300">{complaint.description}</p>

                <div className="mt-5 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {PROGRESS_STEPS.map((step, index) => {
                      const reached = !isRejected && currentStepIndex >= index;
                      const isCurrent = !isRejected && currentStepIndex === index;

                      return (
                        <div
                          key={step}
                          className={cn(
                            'h-2 rounded-full transition-all',
                            isRejected ? 'bg-red-500/35' : reached ? STEP_COLORS[step] : 'bg-slate-700',
                            isCurrent && !isRejected && 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white/70'
                          )}
                        />
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] font-medium">
                    {PROGRESS_STEPS.map((step, index) => {
                      const reached = !isRejected && currentStepIndex >= index;
                      return (
                        <span
                          key={step}
                          className={cn(reached ? 'text-slate-100' : 'text-slate-500')}
                        >
                          {step}
                        </span>
                      );
                    })}
                  </div>

                  {isRejected ? (
                    <p className="text-xs text-red-300">This complaint has been rejected.</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <Dialog open={Boolean(previewComplaint)} onOpenChange={(open) => !open && setPreviewComplaint(null)}>
        <DialogContent className="max-w-3xl bg-slate-950 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              Evidence for {previewComplaint?.title || 'Complaint'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Complaint ID: {previewComplaint?.complaint_id || 'N/A'}
            </DialogDescription>
          </DialogHeader>

          {previewComplaint?.file_url ? (
            <>
              {getEvidenceType(previewComplaint.file_url) === 'image' ? (
                <img
                  src={previewComplaint.file_url}
                  alt="Complaint evidence"
                  className="w-full max-h-[65vh] rounded-md object-contain border border-slate-700"
                />
              ) : null}

              {getEvidenceType(previewComplaint.file_url) === 'video' ? (
                <video
                  src={previewComplaint.file_url}
                  controls
                  className="w-full max-h-[65vh] rounded-md border border-slate-700 bg-black"
                />
              ) : null}

              {getEvidenceType(previewComplaint.file_url) === 'unknown' ? (
                <div className="rounded-md border border-slate-700 p-4 text-sm">
                  <p className="text-slate-300 mb-2">
                    Evidence preview is not available for this file type.
                  </p>
                  <a
                    href={previewComplaint.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-300 underline"
                  >
                    Open evidence file
                  </a>
                </div>
              ) : null}
            </>
          ) : (
            <div className="py-8 text-center text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading evidence...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
