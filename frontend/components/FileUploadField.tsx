'use client';

import { useId, useRef } from 'react';
import { FileUploadIcon } from '@hugeicons/core-free-icons';
import { ACCEPTED_MEDICINE_FILE_EXTENSIONS } from '@/lib/storage';
import Icon from './Icon';

interface FileUploadFieldProps {
  id?: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  file: File | null;
  existingFileName?: string;
  existingFileUrl?: string;
  onFileChange: (file: File | null) => void;
  onClearExisting?: () => void;
}

export default function FileUploadField({
  id,
  label,
  required,
  hint,
  error,
  hideLabel = false,
  file,
  existingFileName,
  existingFileUrl,
  onFileChange,
  onClearExisting,
}: FileUploadFieldProps) {
  const autoId = useId();
  const inputId = id || autoId;
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = file?.name || existingFileName;
  const hasFile = Boolean(file || existingFileName);

  return (
    <div>
      {!hideLabel ? (
        <>
          <label htmlFor={inputId} className="label">
            {label}
            {required ? <span className="text-red-500"> *</span> : null}
          </label>
          {hint ? <p className="mb-1.5 text-xs text-gray-400">{hint}</p> : null}
        </>
      ) : null}

      <div
        className={`rounded-md border bg-white p-3 ${
          error ? 'border-red-300' : 'border-gray-200'
        }`}
      >
        {hasFile ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-900">{displayName}</p>
              {file ? (
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB · ready to upload
                </p>
              ) : existingFileUrl ? (
                <a
                  href={existingFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  View current file
                </a>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="btn-secondary"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => {
                  onFileChange(null);
                  onClearExisting?.();
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
            className="flex w-full flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50/50 px-4 py-6 text-center transition hover:border-gray-400 hover:bg-gray-50"
          >
            <Icon icon={FileUploadIcon} size={20} className="text-gray-400" />
            <span className="mt-1 text-xs font-medium text-gray-700">
              Click to upload a document
            </span>
            <span className="mt-0.5 text-xs text-gray-400">
              PDF, Word, image, or text · max 10 MB
            </span>
          </button>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_MEDICINE_FILE_EXTENSIONS}
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0] || null;
            onFileChange(selected);
          }}
        />
      </div>

      {error && !hideLabel ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
