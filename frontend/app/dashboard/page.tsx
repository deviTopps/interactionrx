'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Settings01Icon, SparklesIcon, Upload04Icon } from '@hugeicons/core-free-icons';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardCommandBar from '@/components/DashboardCommandBar';
import DashboardInteractionResult from '@/components/DashboardInteractionResult';
import DatabaseSetup from '@/components/DatabaseSetup';
import Icon from '@/components/Icon';
import { useAuth } from '@/lib/auth-context';
import { api, CatalogDrug, Herb, HerbalMedicine, InteractionReport } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/permissions';

export default function DashboardPage() {
  const { session, profile } = useAuth();

  const [medicines, setMedicines] = useState<HerbalMedicine[]>([]);
  const [herbs, setHerbs] = useState<Herb[]>([]);
  const [drugs, setDrugs] = useState<CatalogDrug[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<InteractionReport | null>(null);
  const [reportDrugKeys, setReportDrugKeys] = useState<string[]>([]);
  const [checkError, setCheckError] = useState('');

  // The three datasets below are what the command bar searches.
  const loadData = useCallback(() => {
    if (!session) return;

    setNeedsSetup(false);

    api
      .getMedicines()
      .then(setMedicines)
      .catch((err: Error) => {
        if (err.message.includes('Could not find the table')) setNeedsSetup(true);
      });

    api.getHerbs().then(setHerbs).catch(() => setHerbs([]));
    api
      .getDrugCatalog()
      .then((catalog) => setDrugs(catalog.drugs))
      .catch(() => setDrugs([]));
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResult = useCallback(
    (payload: { report: InteractionReport; drugKeys: string[] } | null, error?: string) => {
      if (payload) {
        setReport(payload.report);
        setReportDrugKeys(payload.drugKeys);
        setCheckError('');
        return;
      }

      setReport(null);
      setReportDrugKeys([]);
      setCheckError(error || '');
    },
    []
  );

  const roleLabel = profile ? ROLE_LABELS[profile.role] : '';

  return (
    <DashboardLayout fullBleed>
      {needsSetup ? (
        <div className="p-6">
          <DatabaseSetup onComplete={loadData} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#EEEEEE] px-6 py-3">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#111111]">InteractionRX</h1>
              {roleLabel && (
                <span className="rounded-md bg-[#F3F4F6] px-1.5 py-0.5 text-xs font-medium text-[#6B7280]">
                  {roleLabel}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/settings/account"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F7F7F8]"
              >
                <Icon icon={Settings01Icon} size={16} />
                Configuration
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F7F7F8]"
              >
                <Icon icon={Upload04Icon} size={16} />
                Share
              </button>
              <Link
                href="/interactions"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#FACC15] px-3.5 text-sm font-medium text-[#111111] transition-colors hover:bg-[#EAB308]"
              >
                <Icon icon={SparklesIcon} size={16} />
                New Check
              </Link>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className={`absolute inset-0 flex items-center justify-center px-6 py-8 transition-all duration-500 ease-out ${
                report
                  ? 'pointer-events-none -translate-y-10 opacity-0'
                  : 'translate-y-0 opacity-100'
              }`}
            >
              <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                <Image
                  src="/drug-bank-icon.png"
                  alt=""
                  width={72}
                  height={72}
                  className="mb-4 object-contain"
                  priority
                />
                <h2 className="text-4xl font-bold tracking-tight text-[#111111]">
                  Drug Interaction for Africa
                </h2>
                <p className="mt-2 text-sm text-[#9CA3AF]">
                  Developing the African based Drug bank Database
                </p>
                {checkError && (
                  <p className="mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {checkError}
                  </p>
                )}
              </div>
            </div>

            <div
              className={`absolute inset-0 overflow-y-auto transition-all duration-500 ease-out ${
                report
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-8 opacity-0'
              }`}
            >
              {report && (
                <DashboardInteractionResult
                  report={report}
                  drugKeys={reportDrugKeys}
                  onDismiss={() => handleResult(null)}
                />
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-[#EEEEEE] px-6 py-4">
            <div className="mx-auto w-full max-w-4xl">
              <DashboardCommandBar
                query={query}
                onQueryChange={setQuery}
                medicines={medicines}
                herbs={herbs}
                drugs={drugs}
                onResult={handleResult}
              />
              <p className="mt-3 text-center text-xs text-[#9CA3AF]">
                InteractionRX may display incomplete or outdated data, so please double check the
                response.{' '}
                <Link href="/settings/account" className="underline">
                  Your Privacy
                </Link>{' '}
                &amp;{' '}
                <Link href="/activity-log" className="underline">
                  Activity Log
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
