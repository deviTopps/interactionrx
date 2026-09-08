export type UserRole = 'admin' | 'officer' | 'researcher' | 'collaborator' | 'viewer';

export type Permission = 'read' | 'write' | 'delete' | 'audit' | 'admin';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  role: UserRole;
  department: string;
  is_active: boolean;
  created_at: string;
}

export interface ManagedUser extends UserProfile {
  email: string | null;
}

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  role: Exclude<UserRole, 'viewer'>;
  department?: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  officer: 'Officer',
  researcher: 'Researcher',
  collaborator: 'Collaborator',
  viewer: 'Read Only',
};

export const ASSIGNABLE_ROLES: Exclude<UserRole, 'viewer'>[] = [
  'admin',
  'officer',
  'researcher',
  'collaborator',
];

export function canWrite(permissions: Permission[]) {
  return permissions.includes('write');
}

export function canDelete(permissions: Permission[]) {
  return permissions.includes('delete');
}

export function canAudit(permissions: Permission[]) {
  return permissions.includes('audit');
}

export function canAdmin(permissions: Permission[]) {
  return permissions.includes('admin');
}

export function canManageUsers(profile: UserProfile | null | undefined) {
  return profile?.role === 'admin' || profile?.role === 'officer';
}
