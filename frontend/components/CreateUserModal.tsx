'use client';

import { useEffect, useState } from 'react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import AddUserForm, { rolesForManager } from './AddUserForm';
import Icon from './Icon';
import { ManagedUser, UserRole } from '@/lib/permissions';

const MODAL_TRANSITION_MS = 200;

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: ManagedUser) => void;
  onRolesSetupRequired?: () => void;
  managerRole?: UserRole;
  formKey?: number;
}

export default function CreateUserModal({
  isOpen,
  onClose,
  onSuccess,
  onRolesSetupRequired,
  managerRole,
  formKey = 0,
}: CreateUserModalProps) {
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    }

    setVisible(false);
    const timer = setTimeout(() => setMounted(false), MODAL_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!mounted) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const allowedRoles = rolesForManager(managerRole);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px] ${
          visible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
        className={`modal-panel relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-lg border border-gray-200 bg-white shadow-xl ${
          visible ? 'modal-panel-open' : 'modal-panel-closed'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 id="create-user-title" className="modal-title">
              Add new user
            </h2>
            <p className="modal-subtitle">
              Create an account with email, password, and user type.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Close">
            <Icon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AddUserForm
            key={formKey}
            allowedRoles={allowedRoles}
            compact
            submitLabel="Add user"
            onSuccess={(user) => {
              onSuccess?.(user);
              onClose();
            }}
            onRolesSetupRequired={() => {
              onRolesSetupRequired?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
