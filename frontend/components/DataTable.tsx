'use client';

import { ReactNode, useMemo, useState } from 'react';
import {
  Search01Icon,
  Sorting01Icon,
  SortingDownIcon,
  SortingUpIcon,
} from '@hugeicons/core-free-icons';
import Icon from './Icon';

export type SortDirection = 'asc' | 'desc';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  pageSize?: number;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  toolbar?: ReactNode;
  compact?: boolean;
  /** Extra classes for the outer card, e.g. to tint its border. */
  cardClassName?: string;
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  const icon = active
    ? direction === 'asc'
      ? SortingUpIcon
      : SortingDownIcon
    : Sorting01Icon;

  return (
    <span className={`ml-1 inline-flex ${active ? 'text-brand-600' : 'text-gray-300'}`}>
      <Icon icon={icon} size={12} />
    </span>
  );
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  emptyMessage = 'No records found.',
  emptyIcon,
  pageSize: initialPageSize = 10,
  searchPlaceholder = 'Search...',
  searchFilter,
  toolbar,
  compact = false,
  cardClassName = '',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    if (!search.trim() || !searchFilter) return data;
    const q = search.toLowerCase();
    return data.filter((row) => searchFilter(row, q));
  }, [data, search, searchFilter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;

    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortValue) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = column.sortValue!(a);
      const bVal = column.sortValue!(b);
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const start = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, sorted.length);

  const cellPad = compact ? 'px-4 py-2' : 'px-6 py-4';
  const headPad = compact ? 'px-4 py-2' : 'px-6 py-3';
  const toolbarPad = compact ? 'px-4 py-3' : 'px-6 py-4';
  const footerPad = compact ? 'px-4 py-3' : 'px-6 py-4';
  const emptyPad = compact ? 'py-10' : 'py-16';
  const skeletonRows = compact ? 3 : 5;

  return (
    <div className={`card !p-0 overflow-hidden ${cardClassName}`}>
      <div className={`flex flex-col gap-4 border-b border-gray-200 ${toolbarPad} sm:flex-row sm:items-center sm:justify-between`}>
        <div className="relative flex items-center gap-2">
          <Icon
            icon={Search01Icon}
            size={14}
            className="pointer-events-none absolute left-3 text-gray-400"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-search w-full sm:w-72"
          />
          {toolbar}
        </div>
        <p className="text-sm text-gray-500">
          {loading ? 'Loading...' : `${sorted.length} record${sorted.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className={compact ? 'max-h-[360px] overflow-auto' : 'overflow-x-auto'}>
        <table className="data-table w-full min-w-[800px] border-collapse border border-gray-200 text-left">
          <thead className={compact ? 'sticky top-0 z-10 bg-gray-50' : undefined}>
            <tr className="bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${headPad} border border-gray-200 font-semibold text-gray-600 ${col.headerClassName || ''}`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center hover:text-gray-900"
                    >
                      {col.header}
                      <SortIcon active={sortKey === col.key} direction={sortDir} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className={`${cellPad} border border-gray-200`}>
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={`${cellPad} ${emptyPad} border border-gray-200 text-center`}>
                  {emptyIcon && <div className="mb-3 text-4xl">{emptyIcon}</div>}
                  <p className="text-gray-500">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className="transition hover:bg-gray-50/80"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${cellPad} border border-gray-200 text-gray-700 ${col.className || ''}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && sorted.length > 0 && (
        <div className={`flex flex-col gap-3 border-t border-gray-200 ${footerPad} sm:flex-row sm:items-center sm:justify-between`}>
          <p className="text-sm text-gray-500">
            Showing {start}–{end} of {sorted.length}
          </p>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <label htmlFor="page-size">Rows</label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-md border border-gray-200 px-2 text-xs focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {[5, 10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="btn-secondary !px-2.5 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-2 text-xs text-gray-500">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="btn-secondary !px-2.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
