'use client';

import FileUploadField from '@/components/FileUploadField';

export type InputMode = 'text' | 'upload';

interface TextOrUploadFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  textValue: string;
  onTextChange: (value: string) => void;
  onTextBlur?: () => void;
  textPlaceholder?: string;
  textRows?: number;
  file: File | null;
  existingFileName?: string;
  existingFileUrl?: string;
  onFileChange: (file: File | null) => void;
  onClearExisting?: () => void;
}

export default function TextOrUploadField({
  id,
  label,
  required,
  hint,
  error,
  mode,
  onModeChange,
  textValue,
  onTextChange,
  onTextBlur,
  textPlaceholder,
  textRows = 3,
  file,
  existingFileName,
  existingFileUrl,
  onFileChange,
  onClearExisting,
}: TextOrUploadFieldProps) {
  const textareaClass = `textarea-field ${error ? 'input-field-error' : ''}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="label mb-0">
            {label}
            {required ? <span className="text-red-500"> *</span> : null}
          </label>
          {hint ? <p className="mb-1.5 text-xs text-gray-400">{hint}</p> : null}
        </div>

        <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            onClick={() => onModeChange('text')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              mode === 'text'
                ? 'bg-gray-100 text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Type
          </button>
          <button
            type="button"
            onClick={() => onModeChange('upload')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              mode === 'upload'
                ? 'bg-gray-100 text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Upload document
          </button>
        </div>
      </div>

      {mode === 'text' ? (
        <textarea
          id={id}
          rows={textRows}
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={onTextBlur}
          className={textareaClass}
          placeholder={textPlaceholder}
        />
      ) : (
        <FileUploadField
          id={`${id}-file`}
          label=""
          file={file}
          existingFileName={existingFileName}
          existingFileUrl={existingFileUrl}
          onFileChange={onFileChange}
          onClearExisting={onClearExisting}
          hideLabel
        />
      )}

      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
