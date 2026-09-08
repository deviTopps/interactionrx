'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Attachment01Icon,
  ArrowDown01Icon,
  ArrowUp02Icon,
  Cancel01Icon,
  Loading03Icon,
  Mic01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons';
import Icon from './Icon';
import { api, CatalogDrug, Herb, HerbalMedicine, InteractionReport } from '@/lib/api';

const SOURCES = [
  { value: 'orthodox-orthodox', label: 'Orthodox & Orthodox' },
  { value: 'orthodox-herbal', label: 'Orthodox & Herbal/Local' },
  { value: 'herbal-herbal', label: 'Herbal & Herbal' },
] as const;

type Source = (typeof SOURCES)[number]['value'];

interface Hit {
  key: string;
  label: string;
  detail: string;
  kind: string;
  /** Present for NHIS catalog drugs — these can run the DDI engine. */
  drugKey?: string;
}

interface SelectedMed extends Hit {}

const MAX_HITS = 8;

export default function DashboardCommandBar({
  query,
  onQueryChange,
  medicines,
  herbs,
  drugs,
  onResult,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  medicines: HerbalMedicine[];
  herbs: Herb[];
  drugs: CatalogDrug[];
  onResult: (
    payload: { report: InteractionReport; drugKeys: string[] } | null,
    error?: string
  ) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>('orthodox-orthodox');
  const [selected, setSelected] = useState<SelectedMed[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [checking, setChecking] = useState(false);

  const selectedKeys = useMemo(() => new Set(selected.map((item) => item.key)), [selected]);

  const hits = useMemo<Hit[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];

    const found: Hit[] = [];
    const includeMedicines = source === 'orthodox-herbal' || source === 'herbal-herbal';
    const includeHerbs = source === 'orthodox-herbal' || source === 'herbal-herbal';
    const includeDrugs = source === 'orthodox-orthodox' || source === 'orthodox-herbal';

    if (includeMedicines) {
      medicines
        .filter(
          (medicine) =>
            !selectedKeys.has(`medicine-${medicine.id}`) &&
            medicine.name.toLowerCase().includes(needle)
        )
        .slice(0, MAX_HITS)
        .forEach((medicine) =>
          found.push({
            key: `medicine-${medicine.id}`,
            label: medicine.name,
            detail: medicine.origin || 'Herbal medicine',
            kind: 'Medicine',
          })
        );
    }

    if (includeHerbs) {
      herbs
        .filter(
          (herb) =>
            !selectedKeys.has(`herb-${herb.id}`) &&
            (herb.canonical_name.toLowerCase().includes(needle) ||
              (herb.latin_name || '').toLowerCase().includes(needle))
        )
        .slice(0, MAX_HITS)
        .forEach((herb) =>
          found.push({
            key: `herb-${herb.id}`,
            label: herb.canonical_name,
            detail: herb.latin_name || 'Herb catalog entry',
            kind: 'Herb',
          })
        );
    }

    if (includeDrugs) {
      drugs
        .filter(
          (drug) =>
            !selectedKeys.has(`drug-${drug.ingredient_key}`) &&
            (drug.generic_name.toLowerCase().includes(needle) ||
              (drug.drug_class || '').toLowerCase().includes(needle))
        )
        .slice(0, MAX_HITS)
        .forEach((drug) =>
          found.push({
            key: `drug-${drug.ingredient_key}`,
            label: drug.generic_name,
            detail: drug.drug_class || 'Prescribable drug',
            kind: 'Drug',
            drugKey: drug.ingredient_key,
          })
        );
    }

    return found.slice(0, MAX_HITS);
  }, [query, source, medicines, herbs, drugs, selectedKeys]);

  const drugKeys = selected
    .map((item) => item.drugKey)
    .filter((key): key is string => Boolean(key));
  const canCheck = drugKeys.length >= 2 && !checking;

  const addHit = (hit: Hit) => {
    setSelected((prev) => (prev.some((item) => item.key === hit.key) ? prev : [...prev, hit]));
    onQueryChange('');
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const removeSelected = (key: string) => {
    setSelected((prev) => prev.filter((item) => item.key !== key));
    onResult(null);
  };

  const clearSelected = () => {
    setSelected([]);
    onResult(null);
  };

  const submit = async () => {
    if (!canCheck) return;

    setChecking(true);
    onResult(null);

    try {
      const result = await api.checkDrugInteractions(drugKeys);
      onResult({ report: result.report, drugKeys });
    } catch (err) {
      onResult(null, err instanceof Error ? err.message : 'Interaction check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !query && selected.length > 0) {
      event.preventDefault();
      removeSelected(selected[selected.length - 1].key);
      return;
    }

    if (event.key === 'Escape') {
      onQueryChange('');
      return;
    }

    if (hits.length === 0) {
      if (event.key === 'Enter') {
        event.preventDefault();
        void submit();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % hits.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + hits.length) % hits.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      addHit(hits[activeIndex]);
    }
  };

  return (
    <div className="rounded-lg bg-[#F7F7F8] p-4">
      {selected.length > 0 && (
        <div className="mb-3">
          <ul className="flex flex-wrap gap-2">
            {selected.map((item) => (
              <li
                key={item.key}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#FDE68A] bg-[#FEF9C3] py-1 pl-3 pr-1.5"
              >
                <span className="truncate text-sm font-medium text-[#854D0E]">{item.label}</span>
                <span className="shrink-0 text-xs text-[#A16207]">{item.kind}</span>
                <button
                  type="button"
                  onClick={() => removeSelected(item.key)}
                  aria-label={`Remove ${item.label}`}
                  className="shrink-0 rounded-full p-0.5 text-[#A16207] transition-colors hover:bg-[#FDE68A] hover:text-[#854D0E]"
                >
                  <Icon icon={Cancel01Icon} size={12} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-xs text-[#9CA3AF]">
              {selected.length} selected
              {drugKeys.length < 2
                ? ' — add at least two orthodox medicines to check'
                : checking
                  ? ' — checking…'
                  : ' — ready to check'}
            </p>
            <button
              type="button"
              onClick={clearSelected}
              className="text-xs font-medium text-[#9CA3AF] hover:text-[#111111]"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {query.trim().length > 0 && (
        <div className="mb-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#9CA3AF]">
              Nothing in the registry matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-[#EEEEEE]" role="listbox">
              {hits.map((hit, index) => (
                <li key={hit.key} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => addHit(hit)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      index === activeIndex ? 'bg-[#F7F7F8]' : 'hover:bg-[#F7F7F8]'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#111111]">
                        {hit.label}
                      </span>
                      <span className="block truncate text-xs text-[#9CA3AF]">{hit.detail}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-[#F3F4F6] px-1.5 py-0.5 text-xs font-medium text-[#6B7280]">
                      {hit.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 px-1">
        <span className="text-[#9CA3AF]">
          <Icon icon={SparklesIcon} size={18} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            selected.length === 0
              ? 'Search medicines to check interactions...'
              : 'Add another medicine...'
          }
          aria-label="Search medicines to add"
          autoComplete="off"
          className="w-full border-0 bg-transparent p-0 text-base text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-0"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as Source)}
            aria-label="Select interaction type"
            className="h-9 appearance-none rounded-full border border-[#E5E7EB] bg-white pl-3 pr-8 text-sm font-medium text-[#111111] focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            {SOURCES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
            <Icon icon={ArrowDown01Icon} size={16} />
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="Attachments are not available yet"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#111111] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon={Attachment01Icon} size={16} />
            Attach
          </button>
          <button
            type="button"
            disabled
            title="Voice input is not available yet"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#111111] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon={Mic01Icon} size={16} />
            Voice
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canCheck}
            title={
              canCheck
                ? 'Run interaction check'
                : 'Select at least two orthodox medicines to check'
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1A1A1A] px-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {checking ? (
              <>
                <span className="animate-spin">
                  <Icon icon={Loading03Icon} size={16} />
                </span>
                Checking
              </>
            ) : (
              <>
                Check
                <Icon icon={ArrowUp02Icon} size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
