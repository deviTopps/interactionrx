'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/permissions';

export default function SettingsAccountPage() {
  const { profile, user, loading, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setDepartment(profile.department || 'General');
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError('');
    setError('');
    setMessage('');

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setNameError('Full name is required');
      return;
    }
    if (trimmedName.length < 2) {
      setNameError('Full name must be at least 2 characters');
      return;
    }

    setSaving(true);

    try {
      await api.updateProfile({
        full_name: trimmedName,
        department: department.trim() || 'General',
      });
      await refreshProfile();
      setMessage('Account updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save account details');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!profile) return;
    setFullName(profile.full_name || '');
    setDepartment(profile.department || 'General');
    setNameError('');
    setError('');
    setMessage('');
  };

  if (loading) {
    return (
      <DashboardLayout title="Account">
        <div className="card max-w-xl text-center text-gray-500 py-12">Loading account...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Account">
      <div className="card max-w-xl">
        <p className="mb-6 text-sm text-gray-600">
          View your sign-in details and update your profile information.
        </p>

        {message && (
          <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
        )}
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-section">
            <h2 className="form-section-title">Sign-in details</h2>
            <p className="form-section-hint mb-4">Managed by your administrator.</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="account-email" className="label">
                  Email
                </label>
                <input
                  id="account-email"
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  className="input-field cursor-not-allowed bg-gray-50 text-gray-600"
                />
              </div>

              <div>
                <label htmlFor="account-role" className="label">
                  User type
                </label>
                <select
                  id="account-role"
                  value={profile?.role || ''}
                  disabled
                  className="input-field cursor-not-allowed bg-gray-50 text-gray-600 disabled:opacity-100"
                >
                  {profile ? (
                    <option value={profile.role}>{ROLE_LABELS[profile.role]}</option>
                  ) : (
                    <option value="">—</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">Profile</h2>
            <p className="form-section-hint mb-4">You can edit these details anytime.</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="account-name" className="label">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  id="account-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  className={`input-field ${nameError ? 'input-field-error' : ''}`}
                  placeholder="Your full name"
                  autoComplete="name"
                />
                {nameError && <p className="field-error">{nameError}</p>}
              </div>

              <div>
                <label htmlFor="account-department" className="label">
                  Department
                </label>
                <input
                  id="account-department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Research, Regulatory Affairs"
                  autoComplete="organization"
                />
              </div>
            </div>
          </div>

          <div className="btn-toolbar">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save account'}
            </button>
            <button type="button" onClick={handleReset} disabled={saving} className="btn-secondary">
              Reset
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
