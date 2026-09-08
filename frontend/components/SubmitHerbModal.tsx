'use client';

import { useEffect, useRef, useState } from 'react';
import { Cancel01Icon, ImageUploadIcon } from '@hugeicons/core-free-icons';
import Icon from './Icon';
import { useAuth } from '@/lib/auth-context';
import { api, SubmitHerbData } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  ACCEPTED_HERB_IMAGE_EXTENSIONS,
  uploadHerbImage,
  validateHerbImage,
} from '@/lib/storage';

const MODAL_TRANSITION_MS = 200;

interface SubmitHerbModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type FormErrors = {
  name?: string;
  photo?: string;
  general?: string;
};

export default function SubmitHerbModal({ isOpen, onClose, onSuccess }: SubmitHerbModalProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [variantName, setVariantName] = useState('');
  const [latinName, setLatinName] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }

    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const resetForm = () => {
    setName('');
    setVariantName('');
    setLatinName('');
    setDescription('');
    setPhoto(null);
    setErrors({});
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Herb name is required';
    else if (name.trim().length < 2) next.name = 'Name must be at least 2 characters';
    if (!photo) next.photo = 'Herb photo is required';
    else {
      const photoError = validateHerbImage(photo);
      if (photoError) next.photo = photoError;
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    if (!user || !photo) return;

    setSubmitting(true);
    setErrors({});

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || user.id;

      const uploaded = await uploadHerbImage(photo, userId);

      const payload: SubmitHerbData = {
        name: name.trim(),
        variant_name: variantName.trim() || undefined,
        latin_name: latinName.trim() || undefined,
        description: description.trim() || undefined,
        image_url: uploaded.url,
        image_file_name: uploaded.name,
      };

      await api.submitHerb(payload);
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : 'Could not submit herb',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px] ${
          visible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-herb-title"
        className={`modal-panel relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-lg border border-gray-200 bg-white shadow-xl ${
          visible ? 'modal-panel-open' : 'modal-panel-closed'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 id="submit-herb-title" className="modal-title">
              Submit a herb variant
            </h2>
            <p className="modal-subtitle">
              Can&apos;t find what you&apos;re looking for? Add your own entry for review.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="btn-icon"
            aria-label="Close"
          >
            <Icon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        <form id="submit-herb-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {errors.general && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errors.general}</p>
          )}

          <div>
            <label htmlFor="herb-name" className="label">
              Herb name <span className="text-red-500">*</span>
            </label>
            <input
              id="herb-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`input-field ${errors.name ? 'input-field-error' : ''}`}
              placeholder="e.g. Moringa"
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="herb-variant" className="label">
              Variant / local name
            </label>
            <input
              id="herb-variant"
              type="text"
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              className="input-field"
              placeholder="e.g. Northern Ghana cultivar"
            />
            <p className="mt-1 text-xs text-gray-400">
              Optional — use if this is a regional or cultivar variant not listed elsewhere.
            </p>
          </div>

          <div>
            <label htmlFor="herb-latin" className="label">
              Latin name
            </label>
            <input
              id="herb-latin"
              type="text"
              value={latinName}
              onChange={(e) => setLatinName(e.target.value)}
              className="input-field"
              placeholder="e.g. Moringa oleifera"
            />
          </div>

          <div>
            <label htmlFor="herb-description" className="label">
              Description
            </label>
            <textarea
              id="herb-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input-field resize-none"
              placeholder="Where you found it, traditional uses, distinguishing features..."
            />
          </div>

          <div>
            <label className="label">
              Herb photo <span className="text-red-500">*</span>
            </label>
            <div
              className={`rounded-md border bg-white p-3 ${
                errors.photo ? 'border-red-300' : 'border-gray-200'
              }`}
            >
              {photoPreview ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Herb preview"
                    className="mx-auto max-h-48 rounded-md object-contain"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="btn-secondary"
                    >
                      Replace photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        if (inputRef.current) inputRef.current.value = '';
                      }}
                      className="btn-ghost"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50/50 px-4 py-8 text-center transition hover:border-gray-400 hover:bg-gray-50"
                >
                  <Icon icon={ImageUploadIcon} size={24} className="text-gray-400" />
                  <span className="mt-2 text-xs font-medium text-gray-700">
                    Click to upload a photo
                  </span>
                  <span className="mt-0.5 text-xs text-gray-400">JPG, PNG, or WebP · max 10 MB</span>
                </button>
              )}

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_HERB_IMAGE_EXTENSIONS}
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0] || null;
                  setPhoto(selected);
                  if (selected) {
                    const photoError = validateHerbImage(selected);
                    setErrors((prev) => ({ ...prev, photo: photoError || undefined }));
                  }
                }}
              />
            </div>
            {errors.photo && <p className="field-error">{errors.photo}</p>}
          </div>
        </form>

        <div className="border-t border-gray-200 bg-gray-50/80 px-5 py-3">
          <div className="btn-toolbar justify-end">
            <button type="button" onClick={handleClose} disabled={submitting} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              form="submit-herb-form"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Submitting...' : 'Submit for review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
