import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRoleManagement } from '@/hooks/useRoleManagement';
import { AppRole } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Trash2, Shield, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';

const AVAILABLE_ROLES: AppRole[] = ['citizen', 'police', 'admin'];

const roleIcons: Record<AppRole, React.ReactNode> = {
  citizen: <User className="h-3 w-3" />,
  police: <Shield className="h-3 w-3" />,
  admin: <ShieldCheck className="h-3 w-3" />,
};

const roleColors: Record<AppRole, string> = {
  citizen: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
  police: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
  admin: 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20',
};

export default function RoleManagement() {
  const { users, isLoading, error, addRole, removeRole } = useRoleManagement();
  const [selectedRole, setSelectedRole] = useState<Record<string, AppRole>>({});
  const [isAddingRole, setIsAddingRole] = useState<string | null>(null);
  const [isRemovingRole, setIsRemovingRole] = useState<string | null>(null);

  const handleAddRole = async (userId: string) => {
    const role = selectedRole[userId];
    if (!role) {
      toast.error('Please select a role to add');
      return;
    }

    setIsAddingRole(userId);
    const { error } = await addRole(userId, role);
    setIsAddingRole(null);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Added ${role} role successfully`);
      setSelectedRole((prev) => ({ ...prev, [userId]: undefined as any }));
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    setIsRemovingRole(`${userId}-${role}`);
    const { error } = await removeRole(userId, role);
    setIsRemovingRole(null);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Removed ${role} role successfully`);
    }
  };

  const getAvailableRoles = (currentRoles: AppRole[]) => {
    return AVAILABLE_ROLES.filter((role) => !currentRoles.includes(role));
  };

  if (error) {
    return (
      <DashboardLayout title="Role Management" subtitle="Manage user roles and permissions">
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Role Management" subtitle="Manage user roles and permissions">
      <div className="space-y-6">
        <div className="rounded-lg border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Current Roles</TableHead>
                  <TableHead>Add Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {user.user_id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {user.roles.length === 0 ? (
                            <span className="text-muted-foreground text-sm">No roles</span>
                          ) : (
                            user.roles.map((role) => (
                              <AlertDialog key={role}>
                                <AlertDialogTrigger asChild>
                                  <Badge
                                    variant="secondary"
                                    className={`${roleColors[role]} cursor-pointer flex items-center gap-1`}
                                  >
                                    {roleIcons[role]}
                                    {role}
                                    {isRemovingRole === `${user.user_id}-${role}` ? (
                                      <Loader2 className="h-3 w-3 animate-spin ml-1" />
                                    ) : (
                                      <Trash2 className="h-3 w-3 ml-1" />
                                    )}
                                  </Badge>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Role</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove the "{role}" role from{' '}
                                      {user.full_name || 'this user'}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleRemoveRole(user.user_id, role)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getAvailableRoles(user.roles).length > 0 ? (
                            <>
                              <Select
                                value={selectedRole[user.user_id] || ''}
                                onValueChange={(value) =>
                                  setSelectedRole((prev) => ({
                                    ...prev,
                                    [user.user_id]: value as AppRole,
                                  }))
                                }
                              >
                                <SelectTrigger className="w-[120px]">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getAvailableRoles(user.roles).map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => handleAddRole(user.user_id)}
                                disabled={!selectedRole[user.user_id] || isAddingRole === user.user_id}
                              >
                                {isAddingRole === user.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">All roles assigned</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}