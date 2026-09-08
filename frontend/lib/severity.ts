import { InteractionSeverity } from './api';

export type SeverityKey = InteractionSeverity | 'none';

export interface SeverityStyle {
  label: string;
  /** Solid pill used for severity counts and headers. */
  badge: string;
  /** Border tint for a finding card. */
  card: string;
  /** Filled banner used for the report headline. */
  banner: string;
  /** Small dot used in dense lists. */
  dot: string;
}

export const SEVERITY_STYLES: Record<SeverityKey, SeverityStyle> = {
  contraindicated: {
    label: 'Contraindicated',
    badge: 'bg-red-600 text-white',
    card: 'border-red-300',
    banner: 'border-red-300 bg-red-50 text-red-900',
    dot: 'bg-red-600',
  },
  major: {
    label: 'Major',
    badge: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200',
    card: 'border-red-200',
    banner: 'border-red-200 bg-red-50 text-red-900',
    dot: 'bg-red-500',
  },
  moderate: {
    label: 'Moderate',
    badge: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
    card: 'border-amber-200',
    banner: 'border-amber-200 bg-amber-50 text-amber-900',
    dot: 'bg-amber-500',
  },
  minor: {
    label: 'Minor',
    badge: 'bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200',
    card: 'border-sky-200',
    banner: 'border-sky-200 bg-sky-50 text-sky-900',
    dot: 'bg-sky-500',
  },
  unknown: {
    label: 'Unknown',
    badge: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200',
    card: 'border-gray-200',
    banner: 'border-gray-200 bg-gray-50 text-gray-700',
    dot: 'bg-gray-400',
  },
  none: {
    label: 'Clear',
    badge: 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-200',
    card: 'border-green-200',
    banner: 'border-green-200 bg-green-50 text-green-900',
    dot: 'bg-green-500',
  },
};

export function severityStyle(severity: string | undefined): SeverityStyle {
  return SEVERITY_STYLES[severity as SeverityKey] || SEVERITY_STYLES.unknown;
}
