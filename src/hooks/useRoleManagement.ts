import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/hooks/useAuth';

interface UserWithRoles {
  user_id: string;
  email: string;
  full_name: string | null;
  roles: AppRole[];
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export function useRoleManagement() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsersWithRoles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all profiles (admins can view all)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (profilesError) throw profilesError;

      // Fetch all user roles (admins can view all)
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Get user emails from auth - we'll use user_id as fallback
      // Since we can't access auth.users directly, we'll show user_id
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => {
        const userRoles = (roles || [])
          .filter((r) => r.user_id === profile.user_id)
          .map((r) => r.role as AppRole);

        return {
          user_id: profile.user_id,
          email: profile.user_id, // Using user_id as identifier
          full_name: profile.full_name,
          roles: userRoles,
        };
      });

      setUsers(usersWithRoles);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation - user already has this role
          return { error: { message: 'User already has this role' } };
        }
        throw error;
      }

      await fetchUsersWithRoles();
      return { error: null };
    } catch (err: any) {
      console.error('Error adding role:', err);
      return { error: { message: err.message || 'Failed to add role' } };
    }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      await fetchUsersWithRoles();
      return { error: null };
    } catch (err: any) {
      console.error('Error removing role:', err);
      return { error: { message: err.message || 'Failed to remove role' } };
    }
  };

  useEffect(() => {
    fetchUsersWithRoles();
  }, [fetchUsersWithRoles]);

  return {
    users,
    isLoading,
    error,
    addRole,
    removeRole,
    refetch: fetchUsersWithRoles,
  };
}