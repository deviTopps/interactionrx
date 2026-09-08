'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserMultipleIcon } from '@hugeicons/core-free-icons';
import { rolesForManager } from '@/components/AddUserForm';
import CreateUserModal from '@/components/CreateUserModal';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable, { Column } from '@/components/DataTable';
import Icon from '@/components/Icon';
import UserManagementSetup from '@/components/UserManagementSetup';
import UserRolesSetup from '@/components/UserRolesSetup';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';
import {
  canManageUsers,
  CreateUserData,
  ManagedUser,
  ROLE_LABELS,
  UserRole,
} from '@/lib/permissions';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function RoleSelect({
  user,
  disabled,
  allowedRoles,
  onChange,
}: {
  user: ManagedUser;
  disabled?: boolean;
  allowedRoles: Exclude<UserRole, 'viewer'>[];
  onChange: (user: ManagedUser, role: CreateUserData['role']) => void;
}) {
  const options = allowedRoles.includes(user.role as CreateUserData['role'])
    ? allowedRoles
    : ([user.role, ...allowedRoles] as UserRole[]);

  return (
    <select
      value={user.role}
      disabled={disabled}
      onChange={(e) => onChange(user, e.target.value as CreateUserData['role'])}
      className="h-9 min-w-[10rem] rounded-md border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
    >
      {options.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}

export default function SettingsUsersPage() {
  const { profile, loading: authLoading } = useAuth();
  const { success: showSuccessToast } = useToast();
  const router = useRouter();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsServiceKey, setNeedsServiceKey] = useState(false);
  const [needsRolesExpansion, setNeedsRolesExpansion] = useState(false);
  const [rolesStatusLoading, setRolesStatusLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const allowedRoles = useMemo(() => rolesForManager(profile?.role), [profile?.role]);

  const checkRolesExpansion = useCallback(() => {
    setRolesStatusLoading(true);
    fetch('/api/setup/user-roles-status')
      .then((res) => res.json())
      .then((data) => setNeedsRolesExpansion(!data.applied))
      .catch(() => setNeedsRolesExpansion(false))
      .finally(() => setRolesStatusLoading(false));
  }, []);

  const loadUsers = useCallback(() => {
    setLoading(true);
    setError('');
    api.getUsers()
      .then((data) => {
        setUsers(data);
        setNeedsServiceKey(false);
      })
      .catch((err: Error) => {
        const message = err.message;
        if (
          message.includes('SUPABASE_SERVICE_ROLE_KEY') ||
          message.includes('Invalid API key') ||
          message.includes('invalid or incomplete')
        ) {
          setNeedsServiceKey(true);
        } else {
          setError(message);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!canManageUsers(profile)) {
      router.replace('/settings/account');
      return;
    }
    loadUsers();
    checkRolesExpansion();
  }, [authLoading, profile, loadUsers, checkRolesExpansion, router]);

  const handleUserCreated = useCallback(
    (user: ManagedUser) => {
      setUsers((prev) => [user, ...prev]);
      setError('');
      setNeedsRolesExpansion(false);
      showSuccessToast(
        'User added successfully',
        `${user.full_name || user.email} was created as ${ROLE_LABELS[user.role]}.`
      );
    },
    [showSuccessToast]
  );

  const openCreateModal = useCallback(() => {
    setCreateFormKey((key) => key + 1);
    setShowCreateModal(true);
  }, []);

  const handleRoleChange = useCallback(async (user: ManagedUser, role: CreateUserData['role']) => {
    if (user.role === role) return;

    setUpdatingId(user.user_id);
    setError('');
    try {
      const updated = await api.updateUser(user.user_id, { role });
      setUsers((prev) => prev.map((item) => (item.user_id === updated.user_id ? updated : item)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update user type';
      setError(message);
      if (message.includes('user-roles-expansion.sql')) {
        setNeedsRolesExpansion(true);
      }
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const handleToggleActive = useCallback(async (user: ManagedUser) => {
    setUpdatingId(user.user_id);
    try {
      const updated = await api.updateUser(user.user_id, { is_active: !user.is_active });
      setUsers((prev) => prev.map((item) => (item.user_id === updated.user_id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update user');
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const columns: Column<ManagedUser>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        sortValue: (row) => (row.full_name || '').toLowerCase(),
        render: (row) => (
          <div>
            <p className="font-medium text-gray-900">{row.full_name || '—'}</p>
            <p className="text-sm text-gray-500">{row.email || 'No email'}</p>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'User type',
        sortable: true,
        sortValue: (row) => row.role,
        render: (row) => (
          <RoleSelect
            user={row}
            allowedRoles={allowedRoles}
            disabled={updatingId === row.user_id}
            onChange={handleRoleChange}
          />
        ),
      },
      {
        key: 'department',
        header: 'Department',
        sortable: true,
        sortValue: (row) => row.department.toLowerCase(),
        render: (row) => <span className="text-gray-600">{row.department}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (row) => (row.is_active ? 1 : 0),
        render: (row) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ${
              row.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}
          >
            {row.is_active ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        key: 'created_at',
        header: 'Created',
        sortable: true,
        sortValue: (row) => new Date(row.created_at).getTime(),
        className: 'whitespace-nowrap',
        render: (row) => <span className="text-gray-500">{formatDate(row.created_at)}</span>,
      },
      {
        key: 'actions',
        header: 'Actions',
        headerClassName: 'text-right',
        className: 'text-right',
        render: (row) => (
          <button
            type="button"
            onClick={() => handleToggleActive(row)}
            disabled={updatingId === row.user_id}
            className={row.is_active ? 'btn-danger' : 'btn-secondary'}
          >
            {updatingId === row.user_id ? 'Saving...' : row.is_active ? 'Deactivate' : 'Activate'}
          </button>
        ),
      },
    ],
    [allowedRoles, handleRoleChange, handleToggleActive, updatingId]
  );

  if (authLoading || !canManageUsers(profile)) {
    return (
      <DashboardLayout title="Users">
        <div className="card text-center text-gray-500 py-12">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Users"
      action={
        !needsServiceKey && !needsRolesExpansion ? (
          <button type="button" onClick={openCreateModal} className="btn-primary">
            Add new user
          </button>
        ) : undefined
      }
    >
      <p className="mb-4 text-base leading-relaxed text-gray-600">
        Admins and Officers can create login accounts for{' '}
        <strong>Collaborators</strong>, <strong>Researchers</strong>, <strong>Officers</strong>, and{' '}
        <strong>Admins</strong>.
      </p>

      {needsServiceKey && (
        <div className="mb-6">
          <UserManagementSetup onComplete={loadUsers} />
        </div>
      )}

      {!needsServiceKey && needsRolesExpansion && !rolesStatusLoading && (
        <div className="mb-6">
          <UserRolesSetup onComplete={checkRolesExpansion} />
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {!needsServiceKey && !needsRolesExpansion && (
        <DataTable
        data={users}
        columns={columns}
        keyExtractor={(row) => row.id}
        loading={loading}
        compact
        pageSize={10}
        searchPlaceholder="Search by name, email, or department..."
        searchFilter={(row, query) =>
          (row.full_name || '').toLowerCase().includes(query) ||
          (row.email || '').toLowerCase().includes(query) ||
          row.department.toLowerCase().includes(query) ||
          ROLE_LABELS[row.role].toLowerCase().includes(query)
        }
        emptyIcon={<Icon icon={UserMultipleIcon} size={40} className="mx-auto text-gray-300" />}
        emptyMessage="No users found."
        />
      )}

      {!loading && !needsServiceKey && !needsRolesExpansion && users.length === 0 && (
        <div className="mt-4 text-center">
          <button type="button" onClick={openCreateModal} className="btn-primary inline-flex">
            Add your first user
          </button>
        </div>
      )}

      {!needsServiceKey && !needsRolesExpansion && (
        <CreateUserModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          managerRole={profile?.role}
          onSuccess={handleUserCreated}
          formKey={createFormKey}
          onRolesSetupRequired={() => {
            setNeedsRolesExpansion(true);
            setShowCreateModal(false);
          }}
        />
      )}
    </DashboardLayout>
  );
}
