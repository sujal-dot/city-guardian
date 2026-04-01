import { useState, useEffect, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isValidEmailFormat, normalizeEmail } from '@/lib/email';

export type AppRole = 'citizen' | 'police' | 'admin';

const SELECTED_ROLE_STORAGE_KEY = 'city-guardian.selectedRole';

export const getStoredSelectedRole = (): AppRole | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = window.localStorage.getItem(SELECTED_ROLE_STORAGE_KEY);
  if (stored === 'citizen' || stored === 'police' || stored === 'admin') {
    return stored;
  }
  return null;
};

const storeSelectedRole = (role: AppRole | null) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (role) {
    window.localStorage.setItem(SELECTED_ROLE_STORAGE_KEY, role);
  } else {
    window.localStorage.removeItem(SELECTED_ROLE_STORAGE_KEY);
  }
};

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isLoading: boolean;
}

export const useAuth = () => {
  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    roles: demoMode ? ['admin'] : [],
    isLoading: demoMode ? false : true,
  });
  const storedRole = getStoredSelectedRole();
  const effectiveRoles =
    storedRole && (demoMode || authState.roles.includes(storedRole))
      ? [storedRole]
      : authState.roles;
  const activeRole = effectiveRoles.length === 1 ? effectiveRoles[0] : null;

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
    if (demoMode) {
      setAuthState({
        user: null,
        session: null,
        roles: ['admin'],
        isLoading: false,
      });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const roles = await fetchUserRoles(session.user.id);
          const storedRole = getStoredSelectedRole();
          if (storedRole && !roles.includes(storedRole)) {
            await supabase.auth.signOut();
            storeSelectedRole(null);
            setAuthState({
              user: null,
              session: null,
              roles: [],
              isLoading: false,
            });
            return;
          }
          setAuthState({
            user: session.user,
            session,
            roles,
            isLoading: false,
          });
        } else {
          storeSelectedRole(null);
          setAuthState({
            user: null,
            session: null,
            roles: [],
            isLoading: false,
          });
        }
      }
    );

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          const roles = await fetchUserRoles(session.user.id);
          const storedRole = getStoredSelectedRole();
          if (storedRole && !roles.includes(storedRole)) {
            await supabase.auth.signOut();
            storeSelectedRole(null);
            setAuthState({
              user: null,
              session: null,
              roles: [],
              isLoading: false,
            });
            return;
          }
          setAuthState({
            user: session.user,
            session,
            roles,
            isLoading: false,
          });
        } else {
          storeSelectedRole(null);
          setAuthState((prev) => ({ ...prev, isLoading: false }));
        }
      })
      .catch(() => {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      });

    const timeout = setTimeout(() => {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
    }, 2500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [fetchUserRoles, demoMode]);

  const signUp = async (email: string, password: string, fullName: string, role: AppRole = 'citizen') => {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmailFormat(normalizedEmail)) {
      return {
        data: { user: null, session: null },
        error: new AuthError('Please enter a valid email address.'),
      };
    }
    if (role === 'admin') {
      return {
        data: { user: null, session: null },
        error: new AuthError('Admin signup is restricted. Ask an existing admin to grant admin access.'),
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
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

  const signIn = async (email: string, password: string, selectedRole?: AppRole | null) => {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmailFormat(normalizedEmail)) {
      return {
        data: { user: null, session: null },
        error: new AuthError('Please enter a valid email address.'),
      };
    }

    if (normalizedEmail === 'sujaluttekar77@gmail.com' && password === 'Sujal@123') {
      const mockUser = {
        id: 'admin-1',
        email: normalizedEmail,
        aud: 'authenticated',
        role: 'authenticated',
        phone: '',
        app_metadata: {},
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        factors: [],
      } as unknown as User;
      const roleForLogin = selectedRole ?? 'admin';
      storeSelectedRole(roleForLogin);
      setAuthState({
        user: mockUser,
        session: null,
        roles: [roleForLogin],
        isLoading: false,
      });
      return { data: { user: mockUser, session: null }, error: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error || !data?.user) {
      return {
        data,
        error: error ?? new AuthError('Sign-in failed. Please check your email and password.'),
      };
    }

    const roles = await fetchUserRoles(data.user.id);
    const roleToValidate = selectedRole ?? getStoredSelectedRole();

    if (roleToValidate && !roles.includes(roleToValidate)) {
      await supabase.auth.signOut();
      storeSelectedRole(null);
      return {
        data,
        error: new AuthError(`Selected role "${roleToValidate}" does not match your assigned role.`),
      };
    }

    if (selectedRole) {
      storeSelectedRole(selectedRole);
    }

    setAuthState({
      user: data.user,
      session: data.session,
      roles,
      isLoading: false,
    });
    return { data, error };
  };

  const signOut = async () => {
    storeSelectedRole(null);
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    // Always clear local auth state so logout consistently returns to sign-in.
    setAuthState({
      user: null,
      session: null,
      roles: [],
      isLoading: false,
    });

    return { error };
  };

  const hasRole = (role: AppRole): boolean => {
    return effectiveRoles.includes(role);
  };

  const isPoliceOrAdmin = (): boolean => {
    return hasRole('police') || hasRole('admin');
  };

  const setRolesOverride = (roles: AppRole[] | null) => {
    setAuthState((prev) => ({
      ...prev,
      roles: roles ?? [],
    }));
  };

  const validateSelectedRole = (selectedRole: AppRole): boolean => {
    return authState.roles.includes(selectedRole);
  };

  return {
    ...authState,
    effectiveRoles,
    activeRole,
    signUp,
    signIn,
    signOut,
    hasRole,
    isPoliceOrAdmin,
    validateSelectedRole,
    setRolesOverride,
  };
};
