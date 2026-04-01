import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { User, Session, AuthError } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  effectiveRoles: AppRole[];
  activeRole: AppRole | null;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string, role?: AppRole) => Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }>;
  signIn: (email: string, password: string, selectedRole?: AppRole | null) => Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  hasRole: (role: AppRole) => boolean;
  isPoliceOrAdmin: () => boolean;
  validateSelectedRole: (selectedRole: AppRole) => boolean;
  setRolesOverride: (roles: AppRole[] | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
