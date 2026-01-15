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
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const roles = await fetchUserRoles(session.user.id);
          setAuthState({
            user: session.user,
            session,
            roles,
            isLoading: false,
          });
        } else {
          setAuthState({
            user: null,
            session: null,
            roles: [],
            isLoading: false,
          });
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

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
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

  return {
    ...authState,
    signUp,
    signIn,
    signOut,
    hasRole,
    isPoliceOrAdmin,
  };
};
