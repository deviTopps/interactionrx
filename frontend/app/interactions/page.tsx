'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Refresh01Icon } from '@hugeicons/core-free-icons';
import DashboardLayout from '@/components/DashboardLayout';
import DrugInteractionSetup from '@/components/DrugInteractionSetup';
import Icon from '@/components/Icon';
import InteractionReportModal from '@/components/InteractionReportModal';
import MedicationSelector from '@/components/MedicationSelector';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  DrugCatalog,
  InteractionReport,
  PatientContext,
  SavedInteractionCheck,
} from '@/lib/api';
import { severityStyle } from '@/lib/severity';

const STAFF_ROLES = ['admin', 'officer', 'researcher'];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InteractionsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout title="Interactions">
          <div className="card py-12 text-center text-gray-500">Loading...</div>
        </DashboardLayout>
      }
    >
      <InteractionsContent />
    </Suspense>
  );
}

function InteractionsContent() {
  const { session, profile } = useAuth();
  const searchParams = useSearchParams();
  const appliedDrugsParam = useRef(false);

  const [catalog, setCatalog] = useState<DrugCatalog | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [needsTables, setNeedsTables] = useState(false);
  const [error, setError] = useState('');

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [patientContext, setPatientContext] = useState<PatientContext>({});
  const [showContext, setShowContext] = useState(false);

  const [report, setReport] = useState<InteractionReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');

  const [history, setHistory] = useState<SavedInteractionCheck[]>([]);

  const canSeed = STAFF_ROLES.includes(profile?.role || '');

  const loadCatalog = useCallback(() => {
    setLoadingCatalog(true);
    setError('');
    setNeedsTables(false);

    api
      .getDrugCatalog()
      .then(setCatalog)
      .catch((err: Error) => {
        if (err.message.includes('Drug interaction tables not installed')) {
          setNeedsTables(true);
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoadingCatalog(false));
  }, []);

  const loadHistory = useCallback(() => {
    api
      .getInteractionChecks(6)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    if (!session) return;
    loadCatalog();
    loadHistory();
  }, [session, loadCatalog, loadHistory]);

  // Prefill from the dashboard command bar: /interactions?drugs=key1,key2
  useEffect(() => {
    if (appliedDrugsParam.current || !catalog) return;

    const raw = searchParams.get('drugs');
    if (!raw) return;

    const validKeys = new Set(catalog.drugs.map((drug) => drug.ingredient_key));
    const keys = raw
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key && validKeys.has(key));

    if (keys.length === 0) return;

    appliedDrugsParam.current = true;
    setSelectedKeys(keys);
  }, [catalog, searchParams]);

  const addDrug = useCallback((key: string) => {
    setSelectedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const removeDrug = useCallback((key: string) => {
    setSelectedKeys((prev) => prev.filter((existing) => existing !== key));
  }, []);

  const runCheck = async () => {
    setChecking(true);
    setCheckError('');

    try {
      const result = await api.checkDrugInteractions(selectedKeys, patientContext);
      setReport(result.report);
      setReportOpen(true);
      loadHistory();
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Interaction check failed');
    } finally {
      setChecking(false);
    }
  };

  const openSavedReport = async (id: string) => {
    setCheckError('');

    try {
      const saved = await api.getInteractionCheck(id);
      if (saved.report) {
        setReport(saved.report);
        setReportOpen(true);
        setSelectedKeys(saved.report.medications.map((medication) => medication.key));
        setPatientContext(saved.report.patient_context || {});
      }
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Could not open that report');
    }
  };

  const drugs = useMemo(() => catalog?.drugs || [], [catalog]);
  const needsCatalog = Boolean(catalog?.needs_seed);
  const canCheck = selectedKeys.length >= 2 && !checking;

  if (needsTables) {
    return (
      <DashboardLayout title="Interactions">
        <DrugInteractionSetup variant="tables" onComplete={loadCatalog} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Interactions"
      action={
        <button
          type="button"
          onClick={loadCatalog}
          className="btn-icon"
          aria-label="Reload catalog"
        >
          <Icon icon={Refresh01Icon} size={15} />
        </button>
      }
    >
      {/* Hidden while the report is open so printing captures only the report. */}
      <div className={`mx-auto max-w-2xl ${reportOpen ? 'print:hidden' : ''}`}>
        {needsCatalog && (
          <div className="mb-4">
            <DrugInteractionSetup
              variant="catalog"
              canSeed={canSeed}
              bundleSize={{
                drugs: catalog?.available_drugs_in_bundle ?? 0,
                rules: catalog?.available_rules_in_bundle ?? 0,
              }}
              onComplete={loadCatalog}
            />
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="card">
          {loadingCatalog ? (
            <p className="py-5 text-center text-sm text-gray-500">Loading medicines...</p>
          ) : (
            <MedicationSelector
              drugs={drugs}
              selectedKeys={selectedKeys}
              onAdd={addDrug}
              onRemove={removeDrug}
              onClear={() => setSelectedKeys([])}
            />
          )}

          <button
            type="button"
            onClick={runCheck}
            disabled={!canCheck}
            className="btn-primary mt-3 !h-9 w-full"
          >
            {checking ? 'Checking...' : 'Check interactions'}
          </button>

          {checkError && <p className="field-error mt-2 text-center">{checkError}</p>}

          <div className="mt-3 border-t border-gray-100 pt-3 text-center">
            <button
              type="button"
              onClick={() => setShowContext(!showContext)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              {showContext ? 'Hide patient details' : 'Add patient details (optional)'}
            </button>
          </div>

          {showContext && (
            <div className="form-section mt-2">
              <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <div>
                  <label htmlFor="patient-age" className="label">
                    Age
                  </label>
                  <input
                    id="patient-age"
                    type="number"
                    min="0"
                    max="120"
                    value={patientContext.age || ''}
                    onChange={(event) =>
                      setPatientContext((prev) => ({ ...prev, age: event.target.value }))
                    }
                    placeholder="Years"
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="patient-indication" className="label">
                    Indication
                  </label>
                  <input
                    id="patient-indication"
                    type="text"
                    value={patientContext.indication || ''}
                    onChange={(event) =>
                      setPatientContext((prev) => ({ ...prev, indication: event.target.value }))
                    }
                    placeholder="e.g. hypertension with AF"
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(
                  [
                    ['renal_impairment', 'Renal impairment'],
                    ['hepatic_impairment', 'Hepatic impairment'],
                    ['pregnancy', 'Pregnant or breastfeeding'],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(patientContext[field])}
                      onChange={(event) =>
                        setPatientContext((prev) => ({ ...prev, [field]: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent/30"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <p className="text-xs leading-snug text-gray-500">
                These details do not change which interactions are found — they add targeted
                recommendations to the report.
              </p>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="mt-4">
            <h2 className="text-overline mb-1.5 px-1">Recent reports</h2>
            <ul className="card !p-2">
              {history.map((entry) => {
                const severity = severityStyle(entry.highest_severity);

                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => openSavedReport(entry.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-gray-50"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${severity.dot}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium leading-snug text-gray-900">
                          {entry.drug_names.join(', ')}
                        </span>
                        <span className="block text-xs leading-snug text-gray-500">
                          {formatDate(entry.created_at)} · {entry.finding_count} finding
                          {entry.finding_count === 1 ? '' : 's'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {catalog && !needsCatalog && (
          <p className="mt-4 text-center text-xs text-gray-400">
            {catalog.drug_count} medicines · {catalog.rule_count} interaction monographs
          </p>
        )}
      </div>

      <InteractionReportModal
        isOpen={reportOpen}
        report={report}
        onClose={() => setReportOpen(false)}
      />
    </DashboardLayout>
  );
}
