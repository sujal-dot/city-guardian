import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'citizen' | 'police' | 'admin';

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isLoading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    isLoading: true,
  });

  const fetchUserRoles = useCallback(async (userId: string): Promise<AppRole[]> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }

    return (data?.map((r) => r.role as AppRole)) || [];
  }, []);

  useEffect(() => {
    // Set up auth state listener - use setTimeout to avoid deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Synchronous state update only
        setAuthState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session: session ?? null,
        }));

        // Defer role fetching to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id).then(roles => {
              setAuthState(prev => ({
                ...prev,
                roles,
                isLoading: false,
              }));
            });
          }, 0);
        } else {
          setAuthState(prev => ({
            ...prev,
            roles: [],
            isLoading: false,
          }));
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const roles = await fetchUserRoles(session.user.id);
        setAuthState({
          user: session.user,
          session,
          roles,
          isLoading: false,
        });
      } else {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRoles]);

  const signUp = async (email: string, password: string, fullName: string, role: AppRole = 'citizen') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          requested_role: role, // Store requested role in metadata
        },
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const hasRole = (role: AppRole): boolean => {
    return authState.roles.includes(role);
  };

  const isPoliceOrAdmin = (): boolean => {
    return hasRole('police') || hasRole('admin');
  };

  const validateSelectedRole = (selectedRole: AppRole): boolean => {
    return authState.roles.includes(selectedRole);
  };

  return {
    ...authState,
    signUp,
    signIn,
    signOut,
    hasRole,
    isPoliceOrAdmin,
    validateSelectedRole,
  };
};
