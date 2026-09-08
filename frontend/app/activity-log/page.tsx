'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable, { Column } from '@/components/DataTable';
import { api, AuditLog } from '@/lib/api';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-50 text-green-700',
  UPDATE: 'bg-blue-50 text-blue-700',
  DELETE: 'bg-red-50 text-red-700',
};

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAuditLogs(100)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<AuditLog>[] = [
    {
      key: 'created_at',
      header: 'Date & Time',
      sortable: true,
      sortValue: (row) => new Date(row.created_at).getTime(),
      render: (row) => (
        <span className="whitespace-nowrap text-gray-600">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'user_email',
      header: 'User',
      sortable: true,
      sortValue: (row) => row.user_email?.toLowerCase() || '',
      render: (row) => (
        <span className="text-gray-900">{row.user_email || '—'}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      sortValue: (row) => row.action,
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            actionColors[row.action] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {row.action}
        </span>
      ),
    },
    {
      key: 'entity_name',
      header: 'Record',
      render: (row) => (
        <span className="text-gray-700">{row.entity_name || row.entity_type}</span>
      ),
    },
    {
      key: 'entity_type',
      header: 'Type',
      render: (row) => (
        <span className="text-gray-500 capitalize">{row.entity_type.replace('_', ' ')}</span>
      ),
    },
  ];

  return (
    <DashboardLayout title="Activity Log">
      <p className="mb-6 text-sm text-gray-500">
        Immutable audit trail of all system actions for accountability and compliance.
      </p>

      <DataTable
        data={logs}
        columns={columns}
        keyExtractor={(row) => row.id}
        loading={loading}
        searchPlaceholder="Search by user, action, or record..."
        searchFilter={(row, query) =>
          (row.user_email?.toLowerCase().includes(query) ?? false) ||
          row.action.toLowerCase().includes(query) ||
          (row.entity_name?.toLowerCase().includes(query) ?? false)
        }
        emptyMessage="No activity recorded yet."
        pageSize={15}
      />
    </DashboardLayout>
  );
}
