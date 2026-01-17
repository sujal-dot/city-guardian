import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Complaint {
  id: string;
  complaint_type: string;
  description: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

interface NewComplaint {
  complaint_type: string;
  description: string;
  location_name: string;
  latitude?: number;
  longitude?: number;
}

export function useComplaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch complaints
  const fetchComplaints = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setComplaints(data as Complaint[]);
    } catch (err) {
      console.error('Error fetching complaints:', err);
      setError('Failed to fetch complaints');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit a new complaint
  const submitComplaint = async (complaint: NewComplaint): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // For anonymous submissions, use the rate-limited edge function
      if (!user) {
        const response = await supabase.functions.invoke('submit-anonymous', {
          body: {
            type: 'complaint',
            data: {
              description: complaint.description,
              complaint_type: complaint.complaint_type,
              location_name: complaint.location_name,
              latitude: complaint.latitude,
              longitude: complaint.longitude,
            },
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to submit');
        }

        if (response.data?.error) {
          if (response.data.error === 'Rate limit exceeded') {
            toast.error('Too many submissions', {
              description: response.data.message || 'Please try again later.',
            });
            return false;
          }
          throw new Error(response.data.error);
        }

        toast.success('Complaint submitted successfully!', {
          description: 'Your complaint has been registered and will be reviewed.',
        });

        await fetchComplaints();
        return true;
      }

      // For authenticated users, use direct insert
      const { error: insertError } = await supabase.from('complaints').insert({
        ...complaint,
        user_id: user.id,
      });

      if (insertError) throw insertError;

      toast.success('Complaint submitted successfully!', {
        description: 'Your complaint has been registered and will be reviewed.',
      });

      // Refresh complaints list
      await fetchComplaints();
      return true;
    } catch (err) {
      console.error('Error submitting complaint:', err);
      setError('Failed to submit complaint');
      toast.error('Failed to submit complaint', {
        description: 'Please try again later.',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    fetchComplaints();

    const channel = supabase
      .channel('complaints_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'complaints',
        },
        () => {
          fetchComplaints();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    complaints,
    isLoading,
    error,
    submitComplaint,
    refetch: fetchComplaints,
  };
}
