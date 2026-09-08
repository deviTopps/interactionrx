'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe02Icon, Leaf01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable, { Column } from '@/components/DataTable';
import HerbalImportSetup from '@/components/HerbalImportSetup';
import SubmitHerbModal from '@/components/SubmitHerbModal';
import Icon from '@/components/Icon';
import { useAuth } from '@/lib/auth-context';
import { canWrite } from '@/lib/permissions';
import { api, ImportedHerb } from '@/lib/api';

const SOURCE_LABELS: Record<string, string> = {
  pubmed: 'PubMed',
  wikidata: 'Wikidata',
  user_submission: 'User submission',
};

function displayHerbName(herb: ImportedHerb) {
  return herb.variant_name ? `${herb.name} (${herb.variant_name})` : herb.name;
}

type StatusFilter = 'pending' | 'approved' | 'dismissed' | 'all';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StatusBadge({ status }: { status: ImportedHerb['import_status'] }) {
  const styles =
    status === 'approved'
      ? 'bg-green-50 text-green-700'
      : status === 'dismissed'
        ? 'bg-gray-100 text-gray-500'
        : 'bg-amber-50 text-amber-700';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles}`}>
      {status}
    </span>
  );
}

export default function DiscoverHerbsPage() {
  const { permissions } = useAuth();
  const router = useRouter();
  const [herbs, setHerbs] = useState<ImportedHerb[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actionId, setActionId] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');

  const loadHerbs = useCallback(async (statusOverride?: StatusFilter) => {
    const status = statusOverride ?? statusFilter;
    setLoading(true);
    setError('');
    try {
      const data = await api.getImportedHerbs(status);
      setHerbs(data);
      setNeedsSetup(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load herbs';
      if (message.includes('Import tables not installed') || message.includes('Herb tables not installed') || message.includes('Herb submission tables')) {
        setNeedsSetup(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadHerbs();
  }, [loadHerbs]);

  const handleScrape = async () => {
    setScraping(true);
    setError('');
    try {
      const result = await api.scrapeHerbs(['pubmed', 'wikidata']);
      await loadHerbs();
      if (result.errors?.length) {
        setError(
          `Scraped ${result.upserted} herbs. Some sources had errors: ${result.errors.map((e) => e.source).join(', ')}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scrape failed');
    } finally {
      setScraping(false);
    }
  };

  const handleApprove = useCallback(async (herb: ImportedHerb) => {
    setActionId(herb.id);
    try {
      const { herb: approved } = await api.approveImportedHerb(herb.id);
      await loadHerbs();
      router.push(`/herbs/${approved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to herb catalog');
    } finally {
      setActionId(null);
    }
  }, [loadHerbs, router]);

  const handleDismiss = useCallback(async (id: string) => {
    setActionId(id);
    try {
      await api.dismissImportedHerb(id);
      await loadHerbs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dismiss failed');
    } finally {
      setActionId(null);
    }
  }, [loadHerbs]);

  const columns: Column<ImportedHerb>[] = useMemo(
    () => [
      {
        key: 'photo',
        header: 'Photo',
        render: (row) =>
          row.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.image_url}
              alt={displayHerbName(row)}
              className="h-10 w-10 rounded-md object-cover"
            />
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        sortValue: (row) => displayHerbName(row).toLowerCase(),
        render: (row) => (
          <div>
            <p className="font-medium text-gray-900">{displayHerbName(row)}</p>
            {row.source_url && (
              <a
                href={row.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                View source
              </a>
            )}
          </div>
        ),
      },
      {
        key: 'latin_name',
        header: 'Latin name',
        sortable: true,
        sortValue: (row) => (row.latin_name || '').toLowerCase(),
        className: 'whitespace-nowrap',
        render: (row) => (
          <span className="text-gray-600 italic">{row.latin_name || '—'}</span>
        ),
      },
      {
        key: 'source',
        header: 'Source',
        sortable: true,
        sortValue: (row) => row.source_type,
        render: (row) => (
          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {SOURCE_LABELS[row.source_type] || row.source_type}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (row) => row.import_status,
        render: (row) => <StatusBadge status={row.import_status} />,
      },
      {
        key: 'description',
        header: 'Description',
        sortable: true,
        sortValue: (row) => (row.description || '').toLowerCase(),
        className: 'max-w-xs',
        render: (row) => (
          <p className="line-clamp-1 text-gray-600">{row.description || '—'}</p>
        ),
      },
      {
        key: 'scraped_at',
        header: 'Scraped',
        sortable: true,
        sortValue: (row) => new Date(row.scraped_at).getTime(),
        className: 'whitespace-nowrap',
        render: (row) => (
          <span className="text-gray-500">{formatDate(row.scraped_at)}</span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        headerClassName: 'text-right',
        className: 'text-right',
        render: (row) => {
          if (canWrite(permissions) && row.import_status === 'pending') {
            return (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApprove(row)}
                  disabled={actionId === row.id}
                  className="btn-primary"
                >
                  {actionId === row.id ? 'Adding...' : 'Add to catalog'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(row.id)}
                  disabled={actionId === row.id}
                  className="btn-secondary"
                >
                  Dismiss
                </button>
              </div>
            );
          }

          if (row.import_status === 'approved' && row.canonical_herb_id) {
            return (
              <Link href={`/herbs/${row.canonical_herb_id}`} className="btn-ghost">
                View herb
              </Link>
            );
          }

          return <span className="text-gray-400">—</span>;
        },
      },
    ],
    [permissions, actionId, handleApprove, handleDismiss]
  );

  return (
    <DashboardLayout
      title="Discover Herbs"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            disabled={needsSetup}
            className="btn-secondary"
          >
            <Icon icon={PlusSignIcon} size={14} />
            Submit herb variant
          </button>
          {canWrite(permissions) ? (
            <button
              type="button"
              onClick={handleScrape}
              disabled={scraping || needsSetup}
              className="btn-primary"
            >
              <Icon icon={Globe02Icon} size={14} />
              {scraping ? 'Scraping...' : 'Scrape online sources'}
            </button>
          ) : null}
        </div>
      }
    >
      {needsSetup && (
        <div className="mb-6">
          <HerbalImportSetup onComplete={loadHerbs} />
        </div>
      )}

      <p className="mb-4 text-base leading-relaxed text-gray-600">
        Discover botanical herbs from <strong>PubMed</strong> and <strong>Wikidata</strong>, or{' '}
        <button
          type="button"
          onClick={() => setShowSubmitModal(true)}
          className="text-accent hover:underline"
          disabled={needsSetup}
        >
          submit your own variant
        </button>{' '}
        with a photo if you can&apos;t find what you need. Approved entries go to the{' '}
        <Link href="/herbs" className="text-accent hover:underline">herb catalog</Link>.
      </p>

      {submitSuccess && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{submitSuccess}</p>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(['pending', 'approved', 'dismissed', 'all'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={statusFilter === status ? 'btn-primary' : 'btn-secondary capitalize'}
          >
            {status}
          </button>
        ))}
      </div>

      <DataTable
        data={herbs}
        columns={columns}
        keyExtractor={(row) => row.id}
        loading={loading}
        compact
        pageSize={5}
        searchPlaceholder="Search by name, latin name, or description..."
        searchFilter={(row, query) =>
          displayHerbName(row).toLowerCase().includes(query) ||
          row.name.toLowerCase().includes(query) ||
          (row.variant_name || '').toLowerCase().includes(query) ||
          (row.latin_name || '').toLowerCase().includes(query) ||
          (row.description || '').toLowerCase().includes(query) ||
          row.source_type.toLowerCase().includes(query)
        }
        emptyIcon={<Icon icon={Leaf01Icon} size={40} className="mx-auto text-gray-300" />}
        emptyMessage={
          herbs.length === 0 && !loading
            ? 'No herbs found for this filter. Scrape online sources to discover new entries.'
            : 'No herbs match your search.'
        }
      />

      {!loading && herbs.length === 0 && !needsSetup && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => setShowSubmitModal(true)} className="btn-primary">
            Submit herb variant
          </button>
          {canWrite(permissions) && (
            <button type="button" onClick={handleScrape} disabled={scraping} className="btn-secondary">
              Scrape online sources
            </button>
          )}
        </div>
      )}

      <SubmitHerbModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onSuccess={async () => {
          setSubmitSuccess('Herb submitted for review. It will appear in the pending list.');
          setStatusFilter('pending');
          await loadHerbs('pending');
          setTimeout(() => setSubmitSuccess(''), 5000);
        }}
      />
    </DashboardLayout>
  );
}
