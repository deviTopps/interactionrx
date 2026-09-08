'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { File02Icon, Leaf01Icon } from '@hugeicons/core-free-icons';
import AddMedicineModal from '@/components/AddMedicineModal';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable, { Column } from '@/components/DataTable';
import DeleteModal from '@/components/DeleteModal';
import Icon from '@/components/Icon';
import { useAuth } from '@/lib/auth-context';
import { canDelete, canWrite } from '@/lib/permissions';
import { api, HerbalMedicine } from '@/lib/api';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function HerbalMedicinesPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout title="Herbal Medicines">
          <div className="card text-center text-gray-500 py-12">Loading...</div>
        </DashboardLayout>
      }
    >
      <HerbalMedicinesContent />
    </Suspense>
  );
}

function HerbalMedicinesContent() {
  const { session, permissions } = useAuth();
  const searchParams = useSearchParams();
  const [medicines, setMedicines] = useState<HerbalMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const openAddModal = useCallback(() => {
    setFormKey((k) => k + 1);
    setShowAddModal(true);
  }, []);

  const loadMedicines = () => {
    setLoading(true);
    api.getMedicines()
      .then(setMedicines)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMedicines();
  }, [session]);

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      openAddModal();
    }
  }, [searchParams, openAddModal]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await api.deleteMedicine(deleteTarget.id);
      setMedicines((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteError('');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
      throw err;
    }
  }, [deleteTarget]);

  const columns: Column<HerbalMedicine>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Medicine Name',
        sortable: true,
        sortValue: (row) => row.name.toLowerCase(),
        render: (row) => (
          <div>
            <Link
              href={`/herbal-medicines/${row.id}`}
              className="font-medium text-gray-900 hover:text-brand-600"
            >
              {row.name}
            </Link>
            {row.description && (
              <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{row.description}</p>
            )}
          </div>
        ),
      },
      {
        key: 'origin',
        header: 'Origin',
        sortable: true,
        sortValue: (row) => row.origin.toLowerCase(),
        render: (row) => (
          <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            {row.origin}
          </span>
        ),
      },
      {
        key: 'composition',
        header: 'Composition',
        sortable: true,
        sortValue: (row) =>
          (row.composition_file_name || row.composition || '').toLowerCase(),
        className: 'max-w-xs',
        render: (row) => (
          <p className="line-clamp-1 text-gray-600">
            {row.composition_file_name ? (
              <span className="inline-flex items-center gap-1">
                <Icon icon={File02Icon} size={14} className="shrink-0 text-gray-500" />
                {row.composition_file_name}
              </span>
            ) : (
              row.composition || '—'
            )}
          </p>
        ),
      },
      {
        key: 'ingredients',
        header: 'Ingredients',
        sortable: true,
        sortValue: (row) => row.medicine_ingredients?.length || 0,
        className: 'text-center',
        headerClassName: 'text-center',
        render: (row) => (
          <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-gray-100 px-2 text-xs font-medium text-gray-700">
            {row.medicine_ingredients?.length || 0}
          </span>
        ),
      },
      {
        key: 'created_at',
        header: 'Created',
        sortable: true,
        sortValue: (row) => new Date(row.created_at).getTime(),
        render: (row) => (
          <span className="text-gray-500 whitespace-nowrap">{formatDate(row.created_at)}</span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        headerClassName: 'text-right',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5">
            <Link
              href={`/herbal-medicines/${row.id}`}
              className="btn-ghost"
            >
              {canWrite(permissions) ? 'View / Edit' : 'View'}
            </Link>
            {canDelete(permissions) && (
              <button
                type="button"
                onClick={() => setDeleteTarget({ id: row.id, name: row.name })}
                className="btn-danger"
              >
                Delete
              </button>
            )}
          </div>
        ),
      },
    ],
    [permissions]
  );

  return (
    <DashboardLayout
      title="Herbal Medicines"
      action={
        canWrite(permissions) ? (
          <button type="button" onClick={openAddModal} className="btn-primary">
            + Add
            <kbd className="btn-shortcut">N</kbd>
          </button>
        ) : undefined
      }
    >
      <p className="mb-4 text-base leading-relaxed text-gray-600">
        Registered herbal products only. Botanical herbs are managed separately in the{' '}
        <Link href="/herbs" className="text-accent hover:underline">
          Herb Catalog
        </Link>
        .
      </p>

      <DataTable
        data={medicines}
        columns={columns}
        keyExtractor={(row) => row.id}
        loading={loading}
        compact
        cardClassName="!border-2 !border-[#FDE68A]"
        pageSize={5}
        searchPlaceholder="Search by name or composition..."
        searchFilter={(row, query) =>
          row.name.toLowerCase().includes(query) ||
          (row.composition || row.composition_file_name || '').toLowerCase().includes(query) ||
          row.origin.toLowerCase().includes(query)
        }
        emptyIcon={<Icon icon={Leaf01Icon} size={40} className="mx-auto text-gray-300" />}
        emptyMessage={
          medicines.length === 0
            ? 'No herbal medicines yet. Add your first medicine to get started.'
            : 'No medicines match your search.'
        }
        toolbar={
          !loading && medicines.length > 0 ? (
            <button type="button" onClick={loadMedicines} className="btn-secondary text-xs">
              Refresh
            </button>
          ) : undefined
        }
      />

      {!loading && medicines.length === 0 && canWrite(permissions) && (
        <div className="mt-4 text-center">
          <button type="button" onClick={openAddModal} className="btn-primary inline-flex">
            Add your first medicine
          </button>
        </div>
      )}

      {deleteError && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{deleteError}</p>
      )}

      <AddMedicineModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(medicine) => setMedicines((prev) => [medicine, ...prev])}
        formKey={formKey}
      />

      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete medicine?"
        itemName={deleteTarget?.name}
      />
    </DashboardLayout>
  );
}
