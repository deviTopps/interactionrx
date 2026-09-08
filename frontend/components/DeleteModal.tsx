'use client';

import { useEffect, useState } from 'react';
import { TrashIcon } from '@hugeicons/core-free-icons';
import Icon from './Icon';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message?: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete item?',
  message = 'This action cannot be undone. This will permanently remove the item.',
  itemName,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
}: DeleteModalProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Caller handles errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={loading ? undefined : onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <Icon icon={TrashIcon} size={20} className="text-red-600" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 id="delete-modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {message}
              {itemName && (
                <>
                  {' '}
                  <span className="font-medium text-gray-900">&ldquo;{itemName}&rdquo;</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="btn-toolbar mt-6 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="btn-danger"
          >
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
