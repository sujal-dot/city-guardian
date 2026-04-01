import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/hooks/useAuth';

interface UserWithRoles {
  user_id: string;
  email: string;
  full_name: string | null;
  roles: AppRole[];
  created_at: string | null;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  created_at: string;
}

interface RoleRow {
  role: AppRole;
  user_id: string;
  created_at: string;
}

const LATEST_USER_LIMIT = 5;
const SEARCH_RESULT_LIMIT = 100;
const AUTO_REFRESH_INTERVAL_MS = 10000;

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

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

export function useRoleManagement() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  const backendCandidates = useMemo(
    () => getRoleApiBaseCandidates(backendUrl),
    [backendUrl]
  );
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');

  const fetchUsersWithRoles = useCallback(
    async (searchTerm = '', options?: { silent?: boolean }) => {
      const { silent = false } = options ?? {};
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const normalizedSearchTerm = searchTerm.trim();
        const safeSearchTerm = normalizedSearchTerm.replace(/[,]/g, ' ');
        setCurrentSearchTerm(normalizedSearchTerm);
        const { data: { session } } = await supabase.auth.getSession();
        let backendFetchError: string | null = null;

        if (!session && backendCandidates.length > 0) {
          try {
            const params = new URLSearchParams();
            params.set(
              'limit',
              String(normalizedSearchTerm ? SEARCH_RESULT_LIMIT : LATEST_USER_LIMIT)
            );
            if (normalizedSearchTerm) {
              params.set('search', normalizedSearchTerm);
            }

            let responseData: unknown = null;
            let isSuccess = false;
            let lastBackendError = 'Role backend request failed';

            for (const baseUrl of backendCandidates) {
              try {
                const response = await fetch(`${baseUrl}/admin/users-with-roles?${params.toString()}`);
                responseData = await response.json().catch(() => ({}));
                if (!response.ok) {
                  lastBackendError =
                    (responseData as { error?: string })?.error || `Backend returned ${response.status}`;
                  continue;
                }
                isSuccess = true;
                break;
              } catch (requestError) {
                lastBackendError =
                  requestError instanceof Error ? requestError.message : 'Backend fetch failed';
              }
            }

            if (!isSuccess) {
              throw new Error(lastBackendError);
            }

            const backendUsers = Array.isArray((responseData as { users?: unknown[] })?.users)
              ? ((responseData as { users: unknown[] }).users as Array<{
                  user_id: string;
                  full_name: string | null;
                  roles: AppRole[];
                  created_at: string | null;
                }>)
              : [];
            setUsers(
              backendUsers.map((user) => ({
                user_id: user.user_id,
                email: user.user_id,
                full_name: user.full_name ?? null,
                roles: Array.isArray(user.roles) ? user.roles : [],
                created_at: user.created_at ?? null,
              }))
            );
            return;
          } catch (backendError) {
            backendFetchError =
              backendError instanceof Error ? backendError.message : 'Role backend request failed';
            console.warn('Role backend fetch failed, trying direct Supabase query:', backendError);
          }
        }

        let profilesQuery = supabase
          .from('profiles')
          .select('user_id, full_name, created_at')
          .order('created_at', { ascending: false });

        if (normalizedSearchTerm) {
          profilesQuery = profilesQuery
            .or(`full_name.ilike.%${safeSearchTerm}%,user_id.ilike.%${safeSearchTerm}%`)
            .limit(SEARCH_RESULT_LIMIT);
        } else {
          profilesQuery = profilesQuery.limit(LATEST_USER_LIMIT);
        }

        const { data: profiles, error: profilesError } = await profilesQuery;

        if (profilesError) throw profilesError;

        const profileRows = (profiles || []) as ProfileRow[];
        const profileMap = new Map(profileRows.map((profile) => [profile.user_id, profile]));

        let rolesQuery = supabase
          .from('user_roles')
          .select('user_id, role, created_at')
          .order('created_at', { ascending: false })
          .limit(SEARCH_RESULT_LIMIT);

        if (normalizedSearchTerm) {
          rolesQuery = rolesQuery.ilike('user_id', `%${safeSearchTerm}%`);
        }

        const { data: roles, error: rolesError } = await rolesQuery;

        if (rolesError) throw rolesError;

        const roleRows: RoleRow[] = ((roles || []) as RoleRow[]).slice();
        const profileUserIds = profileRows.map((profile) => profile.user_id);
        const missingRoleUserIds = profileUserIds.filter(
          (userId) => !roleRows.some((role) => role.user_id === userId)
        );

        if (missingRoleUserIds.length > 0) {
          const { data: additionalRoles, error: additionalRolesError } = await supabase
            .from('user_roles')
            .select('user_id, role, created_at')
            .in('user_id', missingRoleUserIds);

          if (additionalRolesError) throw additionalRolesError;

          roleRows.push(...((additionalRoles || []) as RoleRow[]));
        }

        const rolesByUser = new Map<string, Set<AppRole>>();
        const latestRoleCreatedAt = new Map<string, string>();

        roleRows.forEach((roleRow) => {
          if (!rolesByUser.has(roleRow.user_id)) {
            rolesByUser.set(roleRow.user_id, new Set<AppRole>());
          }
          rolesByUser.get(roleRow.user_id)!.add(roleRow.role);

          const currentLatest = latestRoleCreatedAt.get(roleRow.user_id);
          if (!currentLatest || toTimestamp(roleRow.created_at) > toTimestamp(currentLatest)) {
            latestRoleCreatedAt.set(roleRow.user_id, roleRow.created_at);
          }
        });

        const candidateUserIds = new Set<string>();
        profileRows.forEach((profile) => candidateUserIds.add(profile.user_id));
        roleRows.forEach((role) => candidateUserIds.add(role.user_id));

        let usersWithRoles: UserWithRoles[] = Array.from(candidateUserIds).map((userId) => {
          const profile = profileMap.get(userId);
          const roleSet = rolesByUser.get(userId);
          const profileCreatedAt = profile?.created_at ?? null;
          const roleCreatedAt = latestRoleCreatedAt.get(userId) ?? null;
          const createdAt =
            toTimestamp(profileCreatedAt) >= toTimestamp(roleCreatedAt)
              ? profileCreatedAt
              : roleCreatedAt;

          return {
            user_id: userId,
            email: userId,
            full_name: profile?.full_name ?? null,
            roles: roleSet ? Array.from(roleSet) : [],
            created_at: createdAt,
          };
        });

        usersWithRoles = usersWithRoles.sort(
          (a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)
        );

        if (!normalizedSearchTerm) {
          usersWithRoles = usersWithRoles.slice(0, LATEST_USER_LIMIT);
        }

        if (!session && usersWithRoles.length === 0) {
          if (backendFetchError) {
            throw new Error(`Role backend error: ${backendFetchError}`);
          }
          if (backendCandidates.length > 0) {
            throw new Error(
              'Role backend is offline. Start `npm run server` to load role data in demo mode.'
            );
          }
          throw new Error(
            'No authenticated admin session. Sign in with a real admin account to view role data.'
          );
        }

        setUsers(usersWithRoles);
      } catch (err) {
        console.error('Error fetching users:', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch users';
        setError(message);
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [backendCandidates]
  );

  const loadLatestUsers = useCallback(async () => {
    await fetchUsersWithRoles('');
  }, [fetchUsersWithRoles]);

  const searchUsers = useCallback(
    async (term: string) => {
      await fetchUsersWithRoles(term);
    },
    [fetchUsersWithRoles]
  );

  const addRole = async (userId: string, role: AppRole) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session && backendCandidates.length > 0) {
        try {
          let responseData: unknown = null;
          let isSuccess = false;
          let lastBackendError = 'Failed to add role';

          for (const baseUrl of backendCandidates) {
            try {
              const response = await fetch(`${baseUrl}/admin/users/${userId}/roles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
              });
              responseData = await response.json().catch(() => ({}));
              if (!response.ok) {
                lastBackendError =
                  (responseData as { error?: string })?.error || `Backend returned ${response.status}`;
                continue;
              }
              isSuccess = true;
              break;
            } catch (requestError) {
              lastBackendError =
                requestError instanceof Error ? requestError.message : 'Backend request failed';
            }
          }

          if (!isSuccess) {
            return { error: { message: lastBackendError } };
          }

          await fetchUsersWithRoles(currentSearchTerm);
          return { error: null };
        } catch {
          return {
            error: { message: 'Role backend is offline. Start `npm run server` and try again.' },
          };
        }
      }

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

      await fetchUsersWithRoles(currentSearchTerm);
      return { error: null };
    } catch (err: unknown) {
      console.error('Error adding role:', err);
      const message = err instanceof Error ? err.message : 'Failed to add role';
      return { error: { message } };
    }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session && backendCandidates.length > 0) {
        try {
          let responseData: unknown = null;
          let isSuccess = false;
          let lastBackendError = 'Failed to remove role';

          for (const baseUrl of backendCandidates) {
            try {
              const response = await fetch(`${baseUrl}/admin/users/${userId}/roles/${role}`, {
                method: 'DELETE',
              });
              responseData = await response.json().catch(() => ({}));
              if (!response.ok) {
                lastBackendError =
                  (responseData as { error?: string })?.error || `Backend returned ${response.status}`;
                continue;
              }
              isSuccess = true;
              break;
            } catch (requestError) {
              lastBackendError =
                requestError instanceof Error ? requestError.message : 'Backend request failed';
            }
          }

          if (!isSuccess) {
            return { error: { message: lastBackendError } };
          }

          await fetchUsersWithRoles(currentSearchTerm);
          return { error: null };
        } catch {
          return {
            error: { message: 'Role backend is offline. Start `npm run server` and try again.' },
          };
        }
      }

      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      await fetchUsersWithRoles(currentSearchTerm);
      return { error: null };
    } catch (err: unknown) {
      console.error('Error removing role:', err);
      const message = err instanceof Error ? err.message : 'Failed to remove role';
      return { error: { message } };
    }
  };

  useEffect(() => {
    loadLatestUsers();
  }, [loadLatestUsers]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (currentSearchTerm.trim()) return;
      void fetchUsersWithRoles('', { silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [currentSearchTerm, fetchUsersWithRoles]);

  useEffect(() => {
    const handleFocus = () => {
      if (currentSearchTerm.trim()) return;
      void fetchUsersWithRoles('', { silent: true });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentSearchTerm, fetchUsersWithRoles]);

  return {
    users,
    isLoading,
    error,
    currentSearchTerm,
    addRole,
    removeRole,
    refetch: fetchUsersWithRoles,
    loadLatestUsers,
    searchUsers,
  };
}
