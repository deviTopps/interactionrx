'use client';

import { ReactNode, useState } from 'react';
import TextOrUploadField, { InputMode } from '@/components/TextOrUploadField';
import { Ingredient, MedicineFormData } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { uploadMedicineDocument } from '@/lib/storage';

interface MedicineFormProps {
  initialData?: MedicineFormData;
  onSubmit: (data: MedicineFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  compact?: boolean;
  formId?: string;
  hideActions?: boolean;
}

type IngredientErrors = {
  ingredient_name?: string;
  quantity?: string;
  unit?: string;
};

type FormErrors = {
  name?: string;
  origin?: string;
  description?: string;
  composition?: string;
  ingredients?: Record<number, IngredientErrors>;
  ingredientsGeneral?: string;
};

const emptyIngredient = (): Ingredient => ({
  ingredient_name: '',
  quantity: '',
  unit: '',
  notes: '',
});

function ingredientHasContent(ingredient: Ingredient) {
  return Boolean(
    ingredient.ingredient_name.trim() ||
      ingredient.quantity?.trim() ||
      ingredient.unit?.trim() ||
      ingredient.notes?.trim()
  );
}

function getInitialMode(hasFile: boolean, hasText: boolean): InputMode {
  if (hasFile) return 'upload';
  if (hasText) return 'text';
  return 'text';
}

function validateForm(
  name: string,
  origin: string,
  descriptionMode: InputMode,
  descriptionText: string,
  hasDescriptionFile: boolean,
  compositionMode: InputMode,
  compositionText: string,
  hasCompositionFile: boolean,
  ingredients: Ingredient[]
): FormErrors {
  const errors: FormErrors = {};

  const trimmedName = name.trim();
  if (!trimmedName) {
    errors.name = 'Medication name is required';
  } else if (trimmedName.length < 2) {
    errors.name = 'Medication name must be at least 2 characters';
  }

  if (!origin.trim()) {
    errors.origin = 'Origin is required';
  }

  if (descriptionMode === 'text') {
    if (!descriptionText.trim()) {
      errors.description = 'Description is required';
    } else if (descriptionText.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters';
    }
  } else if (!hasDescriptionFile) {
    errors.description = 'Description document is required';
  }

  if (compositionMode === 'text') {
    if (!compositionText.trim()) {
      errors.composition = 'Composition is required';
    } else if (compositionText.trim().length < 10) {
      errors.composition = 'Composition must be at least 10 characters';
    }
  } else if (!hasCompositionFile) {
    errors.composition = 'Composition document is required';
  }

  const filledIngredients = ingredients.filter(ingredientHasContent);
  if (filledIngredients.length === 0) {
    errors.ingredientsGeneral = 'Add at least one ingredient with name, quantity, and unit';
  }

  ingredients.forEach((ingredient, index) => {
    if (!ingredientHasContent(ingredient)) return;

    const rowErrors: IngredientErrors = {};
    if (!ingredient.ingredient_name.trim()) {
      rowErrors.ingredient_name = 'Ingredient name is required';
    }
    if (!ingredient.quantity?.trim()) {
      rowErrors.quantity = 'Quantity is required';
    }
    if (!ingredient.unit?.trim()) {
      rowErrors.unit = 'Unit is required';
    }

    if (Object.keys(rowErrors).length > 0) {
      errors.ingredients = { ...errors.ingredients, [index]: rowErrors };
    }
  });

  return errors;
}

function hasErrors(errors: FormErrors) {
  return (
    Boolean(
      errors.name ||
        errors.origin ||
        errors.description ||
        errors.composition ||
        errors.ingredientsGeneral
    ) || Boolean(errors.ingredients && Object.keys(errors.ingredients).length > 0)
  );
}

function FormField({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {hint ? <p className="mb-1.5 text-xs text-gray-400">{hint}</p> : null}
      {children}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

export default function MedicineForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Save Medicine',
  compact = false,
  formId = 'medicine-form',
  hideActions = false,
}: MedicineFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [composition, setComposition] = useState(initialData?.composition || '');
  const [origin, setOrigin] = useState(initialData?.origin || 'Local');
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initialData?.ingredients?.length ? initialData.ingredients : [emptyIngredient()]
  );

  const [descriptionMode, setDescriptionMode] = useState<InputMode>(
    getInitialMode(
      Boolean(initialData?.description_file_url),
      Boolean(initialData?.description?.trim())
    )
  );
  const [compositionMode, setCompositionMode] = useState<InputMode>(
    getInitialMode(
      Boolean(initialData?.composition_file_url),
      Boolean(initialData?.composition?.trim() && initialData.composition !== 'Document attached')
    )
  );

  const [descriptionFile, setDescriptionFile] = useState<File | null>(null);
  const [compositionFile, setCompositionFile] = useState<File | null>(null);
  const [descriptionFileUrl, setDescriptionFileUrl] = useState(
    initialData?.description_file_url || ''
  );
  const [descriptionFileName, setDescriptionFileName] = useState(
    initialData?.description_file_name || ''
  );
  const [compositionFileUrl, setCompositionFileUrl] = useState(
    initialData?.composition_file_url || ''
  );
  const [compositionFileName, setCompositionFileName] = useState(
    initialData?.composition_file_name || ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const hasDescriptionFile = Boolean(descriptionFile || descriptionFileUrl);
  const hasCompositionFile = Boolean(compositionFile || compositionFileUrl);

  const addIngredient = () => {
    setIngredients([...ingredients, emptyIngredient()]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
    setFieldErrors((prev) => {
      if (!prev.ingredients) return prev;
      const next = { ...prev.ingredients };
      delete next[index];
      return { ...prev, ingredients: Object.keys(next).length ? next : undefined };
    });
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const inputClass = (fieldError?: string) =>
    `input-field ${fieldError ? 'input-field-error' : ''}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const errors = validateForm(
      name,
      origin,
      descriptionMode,
      description,
      hasDescriptionFile,
      compositionMode,
      composition,
      hasCompositionFile,
      ingredients
    );
    setFieldErrors(errors);
    setTouched({
      name: true,
      origin: true,
      description: true,
      composition: true,
      ingredients: true,
    });

    if (hasErrors(errors)) return;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated. Please sign in again.');

      let nextDescriptionUrl: string | null = null;
      let nextDescriptionName: string | null = null;
      let nextCompositionUrl: string | null = null;
      let nextCompositionName: string | null = null;
      let nextDescription = '';
      let nextComposition = '';

      if (descriptionMode === 'text') {
        nextDescription = description.trim();
      } else {
        nextDescriptionUrl = descriptionFileUrl;
        nextDescriptionName = descriptionFileName;
        if (descriptionFile) {
          const uploaded = await uploadMedicineDocument(descriptionFile, user.id);
          nextDescriptionUrl = uploaded.url;
          nextDescriptionName = uploaded.name;
        }
      }

      if (compositionMode === 'text') {
        nextComposition = composition.trim();
      } else {
        nextCompositionUrl = compositionFileUrl;
        nextCompositionName = compositionFileName;
        if (compositionFile) {
          const uploaded = await uploadMedicineDocument(compositionFile, user.id);
          nextCompositionUrl = uploaded.url;
          nextCompositionName = uploaded.name;
        }
        nextComposition = nextCompositionName || 'Document attached';
      }

      await onSubmit({
        name: name.trim(),
        description: descriptionMode === 'text' ? description.trim() : '',
        description_file_url:
          descriptionMode === 'upload' ? nextDescriptionUrl || undefined : '',
        description_file_name:
          descriptionMode === 'upload' ? nextDescriptionName || undefined : '',
        composition: compositionMode === 'text' ? composition.trim() : nextComposition,
        composition_file_url:
          compositionMode === 'upload' ? nextCompositionUrl || undefined : '',
        composition_file_name:
          compositionMode === 'upload' ? nextCompositionName || undefined : '',
        origin: origin.trim(),
        ingredients: ingredients.filter((i) => i.ingredient_name.trim()),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const sectionClass = compact ? 'form-section' : 'card space-y-4';

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className={sectionClass}>
        <div>
          <h2 className="form-section-title">Medication details</h2>
          <p className="form-section-hint">Basic information about the herbal medicine</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField
              id="name"
              label="Medication Name"
              required
              error={touched.name ? fieldErrors.name : undefined}
            >
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => markTouched('name')}
                className={inputClass(touched.name ? fieldErrors.name : undefined)}
                placeholder="Brand or generic name"
                maxLength={255}
              />
            </FormField>
          </div>

          <div>
            <FormField
              id="origin"
              label="Origin"
              required
              error={touched.origin ? fieldErrors.origin : undefined}
            >
              <input
                id="origin"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onBlur={() => markTouched('origin')}
                className={inputClass(touched.origin ? fieldErrors.origin : undefined)}
                placeholder="e.g. Local, Imported"
                maxLength={255}
              />
            </FormField>
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <div>
          <h2 className="form-section-title">Description & composition</h2>
          <p className="form-section-hint">
            Type directly or upload a document for each field
          </p>
        </div>

        <div className="grid gap-4">
          <TextOrUploadField
            id="description"
            label="Description"
            required
            hint="Product summary or leaflet information"
            mode={descriptionMode}
            onModeChange={setDescriptionMode}
            textValue={description}
            onTextChange={setDescription}
            onTextBlur={() => markTouched('description')}
            textPlaceholder="Brief description of the medicine and its intended use"
            textRows={3}
            file={descriptionFile}
            existingFileName={descriptionFileName}
            existingFileUrl={descriptionFileUrl}
            error={touched.description ? fieldErrors.description : undefined}
            onFileChange={(file) => {
              setDescriptionFile(file);
              markTouched('description');
            }}
            onClearExisting={() => {
              setDescriptionFileUrl('');
              setDescriptionFileName('');
            }}
          />

          <TextOrUploadField
            id="composition"
            label="Composition"
            required
            hint="Formulation details or official composition sheet"
            mode={compositionMode}
            onModeChange={setCompositionMode}
            textValue={composition}
            onTextChange={setComposition}
            onTextBlur={() => markTouched('composition')}
            textPlaceholder="List the main active ingredients and their proportions"
            textRows={4}
            file={compositionFile}
            existingFileName={compositionFileName}
            existingFileUrl={compositionFileUrl}
            error={touched.composition ? fieldErrors.composition : undefined}
            onFileChange={(file) => {
              setCompositionFile(file);
              markTouched('composition');
            }}
            onClearExisting={() => {
              setCompositionFileUrl('');
              setCompositionFileName('');
            }}
          />
        </div>
      </div>

      <div className={sectionClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="form-section-title">Ingredients</h2>
            <p className="form-section-hint">Name, quantity, and unit are required per ingredient</p>
          </div>
          <button type="button" onClick={addIngredient} className="btn-secondary shrink-0">
            + Add
          </button>
        </div>

        {touched.ingredients && fieldErrors.ingredientsGeneral ? (
          <p className="field-error">{fieldErrors.ingredientsGeneral}</p>
        ) : null}

        <div className="space-y-3">
          {ingredients.map((ingredient, index) => {
            const rowErrors = fieldErrors.ingredients?.[index];
            const showRowErrors = touched.ingredients;

            return (
              <div
                key={index}
                className="space-y-3 rounded-md border border-gray-200 bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Ingredient {index + 1}
                  </span>
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <FormField
                      id={`ingredient-name-${index}`}
                      label="Ingredient Name"
                      required
                      error={showRowErrors ? rowErrors?.ingredient_name : undefined}
                    >
                      <input
                        id={`ingredient-name-${index}`}
                        value={ingredient.ingredient_name}
                        onChange={(e) =>
                          updateIngredient(index, 'ingredient_name', e.target.value)
                        }
                        onBlur={() => markTouched('ingredients')}
                        className={inputClass(showRowErrors ? rowErrors?.ingredient_name : undefined)}
                        placeholder="e.g. Moringa leaves"
                        maxLength={255}
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField
                      id={`ingredient-qty-${index}`}
                      label="Quantity"
                      required
                      error={showRowErrors ? rowErrors?.quantity : undefined}
                    >
                      <input
                        id={`ingredient-qty-${index}`}
                        value={ingredient.quantity || ''}
                        onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                        onBlur={() => markTouched('ingredients')}
                        className={inputClass(showRowErrors ? rowErrors?.quantity : undefined)}
                        placeholder="e.g. 50"
                        maxLength={100}
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField
                      id={`ingredient-unit-${index}`}
                      label="Unit"
                      required
                      error={showRowErrors ? rowErrors?.unit : undefined}
                    >
                      <input
                        id={`ingredient-unit-${index}`}
                        value={ingredient.unit || ''}
                        onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                        onBlur={() => markTouched('ingredients')}
                        className={inputClass(showRowErrors ? rowErrors?.unit : undefined)}
                        placeholder="e.g. g, ml"
                        maxLength={50}
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <FormField id={`ingredient-notes-${index}`} label="Notes">
                      <input
                        id={`ingredient-notes-${index}`}
                        value={ingredient.notes || ''}
                        onChange={(e) => updateIngredient(index, 'notes', e.target.value)}
                        className="input-field"
                        placeholder="Optional notes about this ingredient"
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}

      {!hideActions ? (
        <div className="btn-toolbar pt-2">
          {onCancel ? (
            <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
              Cancel
            </button>
          ) : null}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : submitLabel}
            {!loading ? <kbd className="btn-shortcut">⌘S</kbd> : null}
          </button>
        </div>
      ) : null}
    </form>
  );
}
