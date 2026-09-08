'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  ASSIGNABLE_ROLES,
  CreateUserData,
  ManagedUser,
  ROLE_LABELS,
  UserRole,
} from '@/lib/permissions';

type FormErrors = {
  email?: string;
  password?: string;
  full_name?: string;
  role?: string;
  general?: string;
};

interface AddUserFormProps {
  allowedRoles?: Exclude<UserRole, 'viewer'>[];
  onSuccess?: (user: ManagedUser) => void;
  onRolesSetupRequired?: () => void;
  submitLabel?: string;
  compact?: boolean;
}

export function rolesForManager(role: UserRole | undefined): Exclude<UserRole, 'viewer'>[] {
  if (role === 'admin') return ASSIGNABLE_ROLES;
  if (role === 'officer') return ['officer', 'researcher', 'collaborator'];
  return [];
}

export default function AddUserForm({
  allowedRoles = ASSIGNABLE_ROLES,
  onSuccess,
  onRolesSetupRequired,
  submitLabel = 'Create account',
  compact = false,
}: AddUserFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<CreateUserData['role']>(allowedRoles[0] || 'collaborator');
  const [department, setDepartment] = useState('General');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setRole(allowedRoles[0] || 'collaborator');
    setDepartment('General');
    setErrors({});
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!email.trim()) next.email = 'Email is required';
    if (!password || password.length < 8) next.password = 'Password must be at least 8 characters';
    if (!fullName.trim()) next.full_name = 'Full name is required';
    if (!role || !allowedRoles.includes(role)) next.role = 'User type is required';
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);

    try {
      const user = await api.createUser({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role,
        department: department.trim() || 'General',
      });
      resetForm();
      onSuccess?.(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create user';
      setErrors({ general: message });
      if (message.includes('user-roles-expansion.sql')) {
        onRolesSetupRequired?.();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-4' : 'space-y-6'}>
      {errors.general && (
        <div className="space-y-2">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errors.general}</p>
          {errors.general.includes('user-roles-expansion.sql') && (
            <p className="text-xs text-gray-600">
              Open{' '}
              <a
                href="https://supabase.com/dashboard/project/blyolwakndjnyhmorwrb/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Supabase SQL Editor
              </a>
              , paste the contents of <code className="text-xs">supabase/user-roles-expansion.sql</code>, run
              it once, then try again.
            </p>
          )}
        </div>
      )}

      <div className={`grid gap-4 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        <div className={compact ? '' : 'sm:col-span-2 lg:col-span-1'}>
          <label htmlFor="add-user-full-name" className="label">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="add-user-full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`input-field ${errors.full_name ? 'input-field-error' : ''}`}
            placeholder="Full name"
          />
          {errors.full_name && <p className="field-error">{errors.full_name}</p>}
        </div>

        <div>
          <label htmlFor="add-user-email" className="label">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="add-user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`input-field ${errors.email ? 'input-field-error' : ''}`}
            placeholder="name@example.com"
          />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="add-user-password" className="label">
            Temporary password <span className="text-red-500">*</span>
          </label>
          <input
            id="add-user-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`input-field ${errors.password ? 'input-field-error' : ''}`}
            placeholder="Minimum 8 characters"
          />
          {errors.password && <p className="field-error">{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="add-user-role" className="label">
            User type <span className="text-red-500">*</span>
          </label>
          <select
            id="add-user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as CreateUserData['role'])}
            className={`input-field ${errors.role ? 'input-field-error' : ''}`}
          >
            {allowedRoles.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABELS[item]}
              </option>
            ))}
          </select>
          {errors.role && <p className="field-error">{errors.role}</p>}
        </div>

        <div>
          <label htmlFor="add-user-department" className="label">
            Department
          </label>
          <input
            id="add-user-department"
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="input-field"
            placeholder="General"
          />
        </div>
      </div>

      <div className="btn-toolbar">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Creating...' : submitLabel}
        </button>
        <button type="button" onClick={resetForm} disabled={submitting} className="btn-secondary">
          Clear form
        </button>
      </div>
    </form>
  );
}
