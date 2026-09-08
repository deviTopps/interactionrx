import { supabase } from './supabase';
import { Permission, UserProfile, ManagedUser, CreateUserData } from './permissions';

export type { ManagedUser, CreateUserData };

// Use same-origin /api routes (proxied to backend via next.config.js rewrites)
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface Ingredient {
  id?: string;
  ingredient_name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
}

export interface HerbalMedicine {
  id: string;
  name: string;
  description?: string;
  description_file_url?: string;
  description_file_name?: string;
  composition?: string;
  composition_file_url?: string;
  composition_file_name?: string;
  origin: string;
  created_at: string;
  updated_at: string;
  medicine_ingredients?: Ingredient[];
}

export interface MedicineFormData {
  name: string;
  description?: string;
  description_file_url?: string;
  description_file_name?: string;
  composition?: string;
  composition_file_url?: string;
  composition_file_name?: string;
  origin?: string;
  ingredients: Ingredient[];
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  created_at: string;
}

export interface ImportedHerb {
  id: string;
  name: string;
  latin_name?: string;
  variant_name?: string;
  description?: string;
  composition?: string;
  origin: string;
  source_type: 'pubmed' | 'wikidata' | 'user_submission' | string;
  source_id: string;
  source_url?: string;
  image_url?: string;
  image_file_name?: string;
  submitted_by?: string;
  raw_metadata?: Record<string, unknown>;
  import_status: 'pending' | 'approved' | 'dismissed';
  canonical_herb_id?: string;
  scraped_at: string;
  created_at: string;
}

export interface SubmitHerbData {
  name: string;
  variant_name?: string;
  latin_name?: string;
  description?: string;
  image_url: string;
  image_file_name: string;
}

export interface Herb {
  id: string;
  canonical_name: string;
  latin_name?: string;
  description?: string;
  image_url?: string;
  wikidata_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ScrapeResult {
  success: boolean;
  stats: { total: number; pubmed: number; wikidata: number };
  errors: { source: string; message: string }[];
  upserted: number;
  records: ImportedHerb[];
}

export interface Interaction {
  id: string;
  canonical_herb_id?: string;
  herb_name: string;
  active_compound?: string;
  drug_or_class: string;
  interaction_type?: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'unknown';
  summary?: string;
  evidence_quote?: string;
  review_status: 'pending' | 'approved' | 'rejected';
  confidence?: number;
  created_at: string;
  canonical_herbs?: { id: string; canonical_name: string; latin_name?: string };
}

export type InteractionSeverity =
  | 'contraindicated'
  | 'major'
  | 'moderate'
  | 'minor'
  | 'unknown';

export interface DrugClass {
  id: string;
  class_key: string;
  name: string;
  description?: string;
}

export interface CatalogDrug {
  id: string;
  ingredient_key: string;
  generic_name: string;
  drug_class?: string;
  nhis_code?: string;
  dosage_forms: string[];
  prescribing_level?: string;
  is_high_alert: boolean;
  source: string;
  classes: string[];
}

export interface DrugCatalog {
  catalog_source: string;
  drug_count: number;
  rule_count: number;
  needs_seed: boolean;
  available_drugs_in_bundle: number;
  available_rules_in_bundle: number;
  classes: DrugClass[];
  drugs: CatalogDrug[];
}

export interface EvidenceRef {
  source: string;
  citation: string;
  url?: string;
}

export interface InteractionFinding {
  rule_id: string;
  rule_key: string;
  severity: InteractionSeverity;
  severity_label: string;
  interaction_type?: 'pharmacokinetic' | 'pharmacodynamic' | 'duplicate_therapy' | 'mixed';
  onset?: 'rapid' | 'delayed' | 'unspecified';
  documentation?: 'excellent' | 'good' | 'fair' | 'theoretical';
  drugs: { key: string; name: string; drug_class?: string }[];
  matched_on: {
    subject: { kind: 'drug' | 'class'; key: string; label: string };
    object: { kind: 'drug' | 'class'; key: string; label: string };
  };
  summary: string;
  mechanism?: string;
  clinical_effect?: string;
  management?: string;
  monitoring?: string;
  references: EvidenceRef[];
  also_matched: { rule_key: string; severity: InteractionSeverity; summary: string }[];
}

export interface PatientContext {
  age?: string;
  weight?: string;
  indication?: string;
  renal_impairment?: boolean;
  hepatic_impairment?: boolean;
  pregnancy?: boolean;
}

export interface InteractionReport {
  reference: string;
  generated_at: string;
  generated_by?: string;
  medications: {
    key: string;
    name: string;
    drug_class?: string;
    dosage_forms: string[];
    prescribing_level?: string;
    nhis_code?: string;
    is_high_alert: boolean;
  }[];
  patient_context: PatientContext;
  summary: {
    medication_count: number;
    pair_count: number;
    finding_count: number;
    cleared_pair_count: number;
    highest_severity: InteractionSeverity | 'none';
    severity_counts: Record<'contraindicated' | 'major' | 'moderate' | 'minor', number>;
    headline: string;
  };
  findings: InteractionFinding[];
  cleared_pairs: string[];
  monitoring_plan: { severity: InteractionSeverity; pair: string; monitoring: string }[];
  recommendations: string[];
  sources: {
    drug_catalog: string;
    knowledge_base: string;
    rules_evaluated: number;
    references: string[];
  };
  disclaimer: string;
}

export interface InteractionCheckResult {
  id: string | null;
  report: InteractionReport;
}

export interface SavedInteractionCheck {
  id: string;
  reference: string;
  drug_names: string[];
  highest_severity: InteractionSeverity | 'none';
  finding_count: number;
  created_at: string;
  report?: InteractionReport;
}

export interface DrugInteractionRule {
  id: string;
  rule_key: string;
  subject_key: string;
  subject_kind: 'drug' | 'class';
  subject_label: string;
  object_key: string;
  object_kind: 'drug' | 'class';
  object_label: string;
  severity: InteractionSeverity;
  interaction_type?: string;
  onset?: string;
  documentation?: string;
  summary: string;
  mechanism?: string;
  clinical_effect?: string;
  management?: string;
  monitoring?: string;
  evidence_refs: EvidenceRef[];
}

export interface SessionInfo {
  user: { id: string; email: string };
  profile: UserProfile;
  permissions: Permission[];
  securitySetupPending?: boolean;
}

async function getAccessToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.');
  }

  const expiresAt = session.expires_at ?? 0;
  if (expiresAt * 1000 - Date.now() < 60_000) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed?.access_token) return refreshed.access_token;
  }

  return session.access_token;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      'Could not reach the API. Make sure the backend is running (cd backend && npm run dev).'
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getMedicines: () =>
    apiRequest<HerbalMedicine[]>('/api/herbal-medicines'),

  getMedicine: (id: string) =>
    apiRequest<HerbalMedicine>(`/api/herbal-medicines/${id}`),

  createMedicine: (data: MedicineFormData) =>
    apiRequest<HerbalMedicine>('/api/herbal-medicines', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMedicine: (id: string, data: MedicineFormData) =>
    apiRequest<HerbalMedicine>(`/api/herbal-medicines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteMedicine: (id: string) =>
    apiRequest<void>(`/api/herbal-medicines/${id}`, {
      method: 'DELETE',
    }),

  getSessionInfo: () => apiRequest<SessionInfo>('/api/profile/me'),

  updateProfile: (data: { full_name?: string; department?: string }) =>
    apiRequest<SessionInfo>('/api/profile/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getUsers: () => apiRequest<ManagedUser[]>('/api/users'),

  createUser: (data: CreateUserData) =>
    apiRequest<ManagedUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (
    userId: string,
    data: Partial<Pick<ManagedUser, 'full_name' | 'role' | 'department' | 'is_active'>>
  ) =>
    apiRequest<ManagedUser>(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getAuditLogs: (limit = 50) =>
    apiRequest<AuditLog[]>(`/api/audit-logs?limit=${limit}`),

  getImportedHerbs: (status = 'pending') =>
    apiRequest<ImportedHerb[]>(`/api/herb-import?status=${status}`),

  scrapeHerbs: (sources?: ('pubmed' | 'wikidata')[]) =>
    apiRequest<ScrapeResult>('/api/herb-import/scrape', {
      method: 'POST',
      body: JSON.stringify({ sources: sources || ['pubmed', 'wikidata'] }),
    }),

  submitHerb: (data: SubmitHerbData) =>
    apiRequest<ImportedHerb>('/api/herb-import/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approveImportedHerb: (id: string) =>
    apiRequest<{ herb: Herb; imported_id: string }>(`/api/herb-import/${id}/approve`, {
      method: 'POST',
    }),

  dismissImportedHerb: (id: string) =>
    apiRequest<ImportedHerb>(`/api/herb-import/${id}/dismiss`, {
      method: 'POST',
    }),

  getHerbs: () => apiRequest<Herb[]>('/api/herbs'),

  getHerb: (id: string) => apiRequest<Herb>(`/api/herbs/${id}`),

  getInteractions: () => apiRequest<Interaction[]>('/api/interactions'),

  createInteraction: (data: Partial<Interaction>) =>
    apiRequest<Interaction>('/api/interactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDrugCatalog: () => apiRequest<DrugCatalog>('/api/drug-interactions/catalog'),

  syncDrugCatalog: () =>
    apiRequest<{
      success: boolean;
      catalog_source: string;
      drugs: number;
      classes: number;
      class_memberships: number;
      rules: number;
    }>('/api/drug-interactions/sync-catalog', { method: 'POST' }),

  checkDrugInteractions: (
    drugKeys: string[],
    patientContext?: PatientContext,
    save = true
  ) =>
    apiRequest<InteractionCheckResult>('/api/drug-interactions/check', {
      method: 'POST',
      body: JSON.stringify({
        drug_keys: drugKeys,
        patient_context: patientContext || {},
        save,
      }),
    }),

  getInteractionChecks: (limit = 20) =>
    apiRequest<SavedInteractionCheck[]>(`/api/drug-interactions/checks?limit=${limit}`),

  getInteractionCheck: (id: string) =>
    apiRequest<SavedInteractionCheck>(`/api/drug-interactions/checks/${id}`),

  deleteInteractionCheck: (id: string) =>
    apiRequest<void>(`/api/drug-interactions/checks/${id}`, { method: 'DELETE' }),

  getDrugInteractionRules: () =>
    apiRequest<DrugInteractionRule[]>('/api/drug-interactions/rules'),
};
