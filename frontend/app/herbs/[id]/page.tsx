'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { api, Herb } from '@/lib/api';

export default function HerbDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [herb, setHerb] = useState<Herb | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    api.getHerb(id)
      .then(setHerb)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="Herb">
        <div className="card text-center text-gray-500 py-12">Loading...</div>
      </DashboardLayout>
    );
  }

  if (error || !herb) {
    return (
      <DashboardLayout title="Herb">
        <div className="card text-center text-red-600 py-12">
          {error || 'Herb not found'}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={herb.canonical_name}
      action={
        <Link href="/herbs" className="btn-secondary">
          Back to herbs
        </Link>
      }
    >
      <div className="card max-w-2xl space-y-4">
        {herb.image_url && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={herb.image_url}
              alt={herb.canonical_name}
              className="max-h-64 w-full rounded-lg object-contain bg-gray-50"
            />
          </div>
        )}
        {herb.latin_name && (
          <div>
            <p className="label">Latin name</p>
            <p className="text-gray-900 italic">{herb.latin_name}</p>
          </div>
        )}
        {herb.description && (
          <div>
            <p className="label">Description</p>
            <p className="text-gray-700 whitespace-pre-wrap">{herb.description}</p>
          </div>
        )}
        {herb.wikidata_id && (
          <div>
            <p className="label">Wikidata</p>
            <a
              href={`https://www.wikidata.org/wiki/${herb.wikidata_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {herb.wikidata_id}
            </a>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
