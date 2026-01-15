import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ComplaintStatus = Database['public']['Enums']['complaint_status'];

interface Complaint {
  id: string;
  user_id: string | null;
  complaint_type: string;
  description: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
}

export const useAdminComplaints = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComplaints = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setComplaints(data || []);
    }
    setIsLoading(false);
  };

  const updateComplaintStatus = async (complaintId: string, status: ComplaintStatus) => {
    const { error } = await supabase
      .from('complaints')
      .update({ status })
      .eq('id', complaintId);

    if (error) {
      throw error;
    }

    await fetchComplaints();
  };

  useEffect(() => {
    fetchComplaints();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('complaints_admin_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
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
    updateComplaintStatus,
    refetch: fetchComplaints,
  };
};
