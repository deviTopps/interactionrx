'use client';

import Link from 'next/link';
import { ArrowRight01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import Icon from './Icon';
import { InteractionReport } from '@/lib/api';
import { severityStyle } from '@/lib/severity';

export default function DashboardInteractionResult({
  report,
  drugKeys,
  onDismiss,
}: {
  report: InteractionReport;
  drugKeys: string[];
  onDismiss?: () => void;
}) {
  const highest = severityStyle(report.summary.highest_severity);
  const readMoreHref = `/interactions?drugs=${encodeURIComponent(drugKeys.join(','))}`;
  const previewFindings = report.findings.slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className="bg-white">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-green-600">
            <Icon icon={CheckmarkCircle02Icon} size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-overline text-[#9CA3AF]">Interaction Result</p>
            <h2 className="mt-1 text-lg font-semibold leading-snug text-[#111111]">
              {report.summary.headline}
            </h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              {report.medications.map((med) => med.name).join(' · ')}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${highest.badge}`}>
            {highest.label}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 pl-10">
          {(
            [
              ['contraindicated', report.summary.severity_counts.contraindicated],
              ['major', report.summary.severity_counts.major],
              ['moderate', report.summary.severity_counts.moderate],
              ['minor', report.summary.severity_counts.minor],
            ] as const
          )
            .filter(([, count]) => count > 0)
            .map(([severity, count]) => {
              const style = severityStyle(severity);
              return (
                <span
                  key={severity}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}
                >
                  {style.label}
                  <span className="tabular-nums">{count}</span>
                </span>
              );
            })}
          {report.summary.finding_count === 0 && (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${highest.badge}`}>
              No interactions found
            </span>
          )}
        </div>
      </div>

      {previewFindings.length > 0 && (
        <ul className="mt-4 space-y-2">
          {previewFindings.map((finding) => {
            const style = severityStyle(finding.severity);
            return (
              <li
                key={finding.rule_id}
                className={`rounded-lg border bg-white p-4 ${style.card}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className="text-sm font-medium text-[#111111]">
                        {finding.drugs.map((drug) => drug.name).join(' + ')}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280]">{finding.summary}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {report.findings.length > previewFindings.length && (
        <p className="mt-2 text-sm text-[#9CA3AF]">
          +{report.findings.length - previewFindings.length} more finding
          {report.findings.length - previewFindings.length === 1 ? '' : 's'} on the full report
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm font-medium text-[#9CA3AF] hover:text-[#111111]"
          >
            Dismiss
          </button>
        ) : (
          <span />
        )}
        <Link
          href={readMoreHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:underline"
        >
          Read more
          <Icon icon={ArrowRight01Icon} size={16} />
        </Link>
      </div>
    </div>
  );
}
