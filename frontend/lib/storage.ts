import { supabase } from './supabase';

export const MEDICINE_DOCUMENT_BUCKET = 'medicine-documents';
export const HERB_IMAGE_BUCKET = 'herb-images';

export const ACCEPTED_HERB_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const ACCEPTED_HERB_IMAGE_EXTENSIONS = '.jpg,.jpeg,.png,.webp';

export const MAX_HERB_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ACCEPTED_MEDICINE_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
];

export const ACCEPTED_MEDICINE_FILE_EXTENSIONS = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt';

export const MAX_MEDICINE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function validateMedicineFile(file: File): string | null {
  if (!ACCEPTED_MEDICINE_FILE_TYPES.includes(file.type)) {
    return 'File type not supported. Use PDF, Word, image, or text files.';
  }
  if (file.size > MAX_MEDICINE_FILE_SIZE) {
    return 'File must be 10 MB or smaller.';
  }
  return null;
}

export async function uploadMedicineDocument(file: File, userId: string) {
  const fileError = validateMedicineFile(file);
  if (fileError) throw new Error(fileError);

  const path = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const { error } = await supabase.storage
    .from(MEDICINE_DOCUMENT_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(MEDICINE_DOCUMENT_BUCKET).getPublicUrl(path);

  return {
    url: data.publicUrl,
    name: file.name,
    path,
  };
}

export function validateHerbImage(file: File): string | null {
  if (!ACCEPTED_HERB_IMAGE_TYPES.includes(file.type)) {
    return 'Photo must be JPG, PNG, or WebP.';
  }
  if (file.size > MAX_HERB_IMAGE_SIZE) {
    return 'Photo must be 10 MB or smaller.';
  }
  return null;
}

export async function uploadHerbImage(file: File, userId: string) {
  const fileError = validateHerbImage(file);
  if (fileError) throw new Error(fileError);

  const path = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const { error } = await supabase.storage
    .from(HERB_IMAGE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(HERB_IMAGE_BUCKET).getPublicUrl(path);

  return {
    url: data.publicUrl,
    name: file.name,
    path,
  };
}
