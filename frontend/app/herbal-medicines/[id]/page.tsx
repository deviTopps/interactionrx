'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { File02Icon, Leaf01Icon } from '@hugeicons/core-free-icons';
import DashboardLayout from '@/components/DashboardLayout';
import DeleteModal from '@/components/DeleteModal';
import MedicineForm from '@/components/MedicineForm';
import Icon from '@/components/Icon';
import { api, HerbalMedicine, MedicineFormData } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { canDelete, canWrite } from '@/lib/permissions';

export default function MedicineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { permissions } = useAuth();
  const [medicine, setMedicine] = useState<HerbalMedicine | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!id) return;

    api.getMedicine(id)
      .then(setMedicine)
      .catch(() => router.push('/herbal-medicines'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleUpdate = async (data: MedicineFormData) => {
    if (!id) return;
    const updated = await api.updateMedicine(id, data);
    setMedicine(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!medicine || !id) return;
    await api.deleteMedicine(id);
    router.push('/herbal-medicines');
  };

  if (loading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="card text-center text-gray-500 py-12">Loading medicine...</div>
      </DashboardLayout>
    );
  }

  if (!medicine) return null;

  const formData: MedicineFormData = {
    name: medicine.name,
    description: medicine.description,
    description_file_url: medicine.description_file_url,
    description_file_name: medicine.description_file_name,
    composition: medicine.composition,
    composition_file_url: medicine.composition_file_url,
    composition_file_name: medicine.composition_file_name,
    origin: medicine.origin,
    ingredients: medicine.medicine_ingredients || [],
  };

  return (
    <DashboardLayout
      title={editing ? 'Edit Medicine' : medicine.name}
      action={
        <div className="btn-toolbar">
          <Link href="/herbal-medicines" className="btn-secondary">
            ← Back
          </Link>
          {!editing && canWrite(permissions) && (
            <button onClick={() => setEditing(true)} className="btn-primary">
              Edit
            </button>
          )}
          {!editing && canDelete(permissions) && (
            <button onClick={() => setShowDeleteModal(true)} className="btn-danger">
              Delete
            </button>
          )}
        </div>
      }
    >
      {editing && canWrite(permissions) ? (
        <div className="max-w-3xl">
          <MedicineForm
            initialData={formData}
            onSubmit={handleUpdate}
            submitLabel="Update Medicine"
          />
          <button
            onClick={() => setEditing(false)}
            className="btn-secondary mt-4"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="max-w-3xl space-y-6">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center text-brand-700">
                <Icon icon={Leaf01Icon} size={28} />
              </span>
              <div>
                <h2 className="text-xl font-semibold">{medicine.name}</h2>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                  {medicine.origin}
                </span>
              </div>
            </div>

            {medicine.description_file_url ? (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
                <a
                  href={medicine.description_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                >
                  <Icon icon={File02Icon} size={14} className="shrink-0 text-gray-500" />
                  {medicine.description_file_name || 'View description document'}
                </a>
              </div>
            ) : medicine.description ? (
              <p className="text-gray-600 mb-4">{medicine.description}</p>
            ) : null}

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Composition</h3>
              {medicine.composition_file_url ? (
                <a
                  href={medicine.composition_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                >
                  <Icon icon={File02Icon} size={14} className="shrink-0 text-gray-500" />
                  {medicine.composition_file_name || 'View composition document'}
                </a>
              ) : (
                <p className="text-gray-900 whitespace-pre-wrap">{medicine.composition}</p>
              )}
            </div>

            <p className="mt-4 text-xs text-gray-400">
              Created {new Date(medicine.created_at).toLocaleDateString()} ·
              Updated {new Date(medicine.updated_at).toLocaleDateString()}
            </p>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Ingredients ({medicine.medicine_ingredients?.length || 0})
            </h3>

            {medicine.medicine_ingredients?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 font-medium">Ingredient</th>
                      <th className="pb-2 font-medium">Quantity</th>
                      <th className="pb-2 font-medium">Unit</th>
                      <th className="pb-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicine.medicine_ingredients.map((ing) => (
                      <tr key={ing.id} className="border-b border-gray-100">
                        <td className="py-3 font-medium text-gray-900">
                          {ing.ingredient_name}
                        </td>
                        <td className="py-3 text-gray-600">{ing.quantity || '—'}</td>
                        <td className="py-3 text-gray-600">{ing.unit || '—'}</td>
                        <td className="py-3 text-gray-500">{ing.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No ingredients recorded.</p>
            )}
          </div>
        </div>
      )}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete medicine?"
        itemName={medicine.name}
      />
    </DashboardLayout>
  );
}
