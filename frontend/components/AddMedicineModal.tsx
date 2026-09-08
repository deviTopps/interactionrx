'use client';

import { useEffect, useState } from 'react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import MedicineForm from './MedicineForm';
import Icon from './Icon';
import { api, HerbalMedicine, MedicineFormData } from '@/lib/api';

const MODAL_TRANSITION_MS = 200;

interface AddMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (medicine: HerbalMedicine) => void;
  formKey?: number;
}

export default function AddMedicineModal({
  isOpen,
  onClose,
  onSuccess,
  formKey = 0,
}: AddMedicineModalProps) {
  const [submitting, setSubmitting] = useState(false);
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
      if (e.key === 'Escape' && !submitting) onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [mounted, onClose, submitting]);

  if (!mounted) return null;

  const handleSubmit = async (data: MedicineFormData) => {
    setSubmitting(true);
    try {
      const medicine = await api.createMedicine(data);
      onSuccess?.(medicine);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px] ${
          visible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
        }`}
        onClick={submitting ? undefined : onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-medicine-title"
        className={`modal-panel relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-lg border border-gray-200 bg-white shadow-xl ${
          visible ? 'modal-panel-open' : 'modal-panel-closed'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 id="add-medicine-title" className="modal-title">
              Add Herbal Medicine
            </h2>
            <p className="modal-subtitle">Fields marked with * are required</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-icon"
            aria-label="Close"
          >
            <Icon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <MedicineForm
            key={formKey}
            formId="add-medicine-form"
            onSubmit={handleSubmit}
            onCancel={onClose}
            submitLabel="Create Medicine"
            compact
            hideActions
          />
        </div>

        <div className="border-t border-gray-200 bg-gray-50/80 px-5 py-3">
          <div className="btn-toolbar justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-medicine-form"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Creating...' : 'Create Medicine'}
              {!submitting ? <kbd className="btn-shortcut">⌘↵</kbd> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
