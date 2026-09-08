'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import Icon from './Icon';
import { CatalogDrug } from '@/lib/api';

const MAX_RESULTS = 20;

export default function MedicationSelector({
  drugs,
  selectedKeys,
  onAdd,
  onRemove,
  onClear,
}: {
  drugs: CatalogDrug[];
  selectedKeys: string[];
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const selectedDrugs = useMemo(
    () =>
      selectedKeys
        .map((key) => drugs.find((drug) => drug.ingredient_key === key))
        .filter((drug): drug is CatalogDrug => Boolean(drug)),
    [selectedKeys, drugs]
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const available = drugs.filter((drug) => !selectedSet.has(drug.ingredient_key));

    // An empty query still lists the catalog so the field can be browsed.
    if (!needle) {
      return [...available]
        .sort((a, b) => a.generic_name.localeCompare(b.generic_name))
        .slice(0, MAX_RESULTS);
    }

    return available
      .filter(
        (drug) =>
          drug.generic_name.toLowerCase().includes(needle) ||
          (drug.drug_class || '').toLowerCase().includes(needle) ||
          (drug.nhis_code || '').toLowerCase().includes(needle)
      )
      // Names that start with the query come before mid-word matches.
      .sort((a, b) => {
        const aStarts = a.generic_name.toLowerCase().startsWith(needle) ? 0 : 1;
        const bStarts = b.generic_name.toLowerCase().startsWith(needle) ? 0 : 1;
        return aStarts - bStarts || a.generic_name.localeCompare(b.generic_name);
      })
      .slice(0, MAX_RESULTS);
  }, [query, drugs, selectedSet]);

  useEffect(() => setActiveIndex(0), [query]);

  const showResults = open;

  const add = (key: string) => {
    onAdd(key);
    setQuery('');
    // Keep focus so several medicines can be added without reaching for the mouse.
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setQuery('');
      setOpen(false);
      return;
    }

    if (!showResults || results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      add(results[activeIndex].ingredient_key);
    }
  };

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Icon icon={Search01Icon} size={15} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search a medicine to add..."
          aria-label="Search medicines"
          aria-expanded={showResults}
          autoComplete="off"
          className="input-search !h-10"
        />

        {showResults && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li className="px-3.5 py-3 text-sm text-gray-500">
                {query ? `No medicine matches "${query}".` : 'Every medicine is already selected.'}
              </li>
            ) : (
              results.map((drug, index) => (
                <li key={drug.ingredient_key} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    // Prevent the input from blurring so the list stays open for the next add.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => add(drug.ingredient_key)}
                    className={`flex w-full items-center gap-2 px-3.5 py-2 text-left ${
                      index === activeIndex ? 'bg-gray-50' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-snug text-gray-900">
                        {drug.generic_name}
                      </span>
                      <span className="block truncate text-xs leading-snug text-gray-400">
                        {drug.drug_class || 'Unclassified'}
                      </span>
                    </span>
                    {drug.is_high_alert && (
                      <span
                        title="High-alert medicine"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                      />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {selectedDrugs.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          Add at least two medicines to check for interactions.
        </p>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {selectedDrugs.map((drug) => (
              <li
                key={drug.ingredient_key}
                title={drug.drug_class || undefined}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-3 pr-1.5"
              >
                {drug.is_high_alert && (
                  <span
                    title="High-alert medicine"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                  />
                )}
                <span className="truncate text-sm font-medium text-gray-800">
                  {drug.generic_name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(drug.ingredient_key)}
                  aria-label={`Remove ${drug.generic_name}`}
                  className="shrink-0 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                >
                  <Icon icon={Cancel01Icon} size={12} />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-xs text-gray-400">
              {selectedDrugs.length} selected
              {selectedDrugs.length < 2 ? ' — add one more' : ''}
            </p>
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-gray-400 hover:text-gray-900"
            >
              Clear all
            </button>
          </div>
        </>
      )}
    </div>
  );
}
