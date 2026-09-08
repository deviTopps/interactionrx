'use client';

import { useEffect, useState } from 'react';
import { Cancel01Icon, PrinterIcon } from '@hugeicons/core-free-icons';
import Icon from './Icon';
import InteractionReportView from './InteractionReportView';
import { InteractionReport } from '@/lib/api';
import { severityStyle } from '@/lib/severity';

const MODAL_TRANSITION_MS = 200;

export default function InteractionReportModal({
  isOpen,
  report,
  onClose,
}: {
  isOpen: boolean;
  report: InteractionReport | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    }

    setVisible(false);
    const timer = setTimeout(() => setMounted(false), MODAL_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!mounted) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [mounted, onClose]);

  if (!mounted || !report) return null;

  const severity = severityStyle(report.summary.highest_severity);

  return (
    // The print variants flatten the dialog into normal page flow so the whole
    // report prints instead of just the slice visible in the viewport.
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:static print:block print:p-0">
      <div
        className={`modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px] print:hidden ${
          visible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="interaction-report-title"
        className={`modal-panel relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-lg border border-gray-200 bg-white shadow-xl print:max-h-none print:max-w-none print:rounded-none print:border-0 print:shadow-none ${
          visible ? 'modal-panel-open' : 'modal-panel-closed'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 print:px-0">
          <div className="min-w-0">
            <h2 id="interaction-report-title" className="modal-title">
              Interaction report
            </h2>
            <p className="truncate text-xs text-gray-500">
              {report.medications.map((medication) => medication.name).join(' · ')}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-flex items-center rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${severity.badge}`}
            >
              {severity.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="btn-icon print:hidden"
              aria-label="Close report"
            >
              <Icon icon={Cancel01Icon} size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 print:overflow-visible print:px-0">
          <InteractionReportView report={report} />
        </div>

        <div className="border-t border-gray-200 bg-gray-50/80 px-5 py-3 print:hidden">
          <div className="btn-toolbar justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
            <button type="button" onClick={() => window.print()} className="btn-primary">
              <Icon icon={PrinterIcon} size={15} />
              Print report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
