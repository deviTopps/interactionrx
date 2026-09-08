'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Leaf01Icon } from '@hugeicons/core-free-icons';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable, { Column } from '@/components/DataTable';
import HerbalImportSetup from '@/components/HerbalImportSetup';
import Icon from '@/components/Icon';
import { useAuth } from '@/lib/auth-context';
import { api, Herb } from '@/lib/api';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function HerbsPage() {
  const { session } = useAuth();
  const [herbs, setHerbs] = useState<Herb[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;

    setLoading(true);
    setError('');
    api.getHerbs()
      .then(setHerbs)
      .catch((err: Error) => {
        if (err.message.includes('Herb tables not installed')) {
          setNeedsSetup(true);
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [session]);

  const columns: Column<Herb>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        sortValue: (row) => row.canonical_name.toLowerCase(),
        render: (row) => (
          <Link href={`/herbs/${row.id}`} className="font-medium text-gray-900 hover:text-brand-600">
            {row.canonical_name}
          </Link>
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
        key: 'description',
        header: 'Description',
        sortable: true,
        sortValue: (row) => (row.description || '').toLowerCase(),
        className: 'max-w-md',
        render: (row) => (
          <p className="line-clamp-1 text-gray-600">{row.description || '—'}</p>
        ),
      },
      {
        key: 'created_at',
        header: 'Added',
        sortable: true,
        sortValue: (row) => new Date(row.created_at).getTime(),
        className: 'whitespace-nowrap',
        render: (row) => (
          <span className="text-gray-500">{formatDate(row.created_at)}</span>
        ),
      },
    ],
    []
  );

  return (
    <DashboardLayout
      title="Herb Catalog"
      action={
        <Link href="/herbs/discover" className="btn-primary">
          Discover herbs
        </Link>
      }
    >
      {needsSetup && (
        <div className="mb-6">
          <HerbalImportSetup onComplete={() => window.location.reload()} />
        </div>
      )}

      <p className="mb-4 text-base leading-relaxed text-gray-600">
        Botanical reference catalog. Herbal medicines are registered separately under{' '}
        <Link href="/herbal-medicines" className="text-accent hover:underline">
          Herbal Medicines
        </Link>
        .
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <DataTable
        data={herbs}
        columns={columns}
        keyExtractor={(row) => row.id}
        loading={loading}
        compact
        pageSize={5}
        searchPlaceholder="Search herbs by name or latin name..."
        searchFilter={(row, query) =>
          row.canonical_name.toLowerCase().includes(query) ||
          (row.latin_name || '').toLowerCase().includes(query) ||
          (row.description || '').toLowerCase().includes(query)
        }
        emptyIcon={<Icon icon={Leaf01Icon} size={40} className="mx-auto text-gray-300" />}
        emptyMessage={
          herbs.length === 0 && !loading
            ? 'No herbs in the catalog yet. Use Discover Herbs to find and approve entries.'
            : 'No herbs match your search.'
        }
      />
    </DashboardLayout>
  );
}
