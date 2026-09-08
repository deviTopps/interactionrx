'use client';

import { useState } from 'react';
import { AlertCircleIcon, CheckmarkCircle02Icon, Link01Icon } from '@hugeicons/core-free-icons';
import Icon from './Icon';
import { InteractionFinding, InteractionReport } from '@/lib/api';
import { SEVERITY_STYLES, severityStyle } from '@/lib/severity';

const TYPE_LABELS: Record<string, string> = {
  pharmacokinetic: 'Pharmacokinetic',
  pharmacodynamic: 'Pharmacodynamic',
  duplicate_therapy: 'Duplicate therapy',
  mixed: 'Mixed mechanism',
};

const ONSET_LABELS: Record<string, string> = {
  rapid: 'Rapid onset',
  delayed: 'Delayed onset',
  unspecified: 'Onset unspecified',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Section({
  title,
  count,
  hint,
  className = '',
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`break-inside-avoid rounded-lg border border-gray-200 p-4 ${className}`}
    >
      <h3 className="text-sm font-semibold text-gray-900">
        {title}
        {count !== undefined && <span className="ml-1.5 font-normal text-gray-400">{count}</span>}
      </h3>
      {hint && <p className="mt-0.5 text-xs leading-snug text-gray-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// The label sits in a fixed left gutter so the detail blocks read as a dense
// table rather than a stack of headings.
function Detail({ label, children }: { label: string; children?: string }) {
  if (!children) return null;

  return (
    <div className="sm:flex sm:gap-3">
      <dt className="text-overline shrink-0 sm:w-[6.5rem] sm:pt-px">{label}</dt>
      <dd className="text-sm leading-snug text-gray-700">{children}</dd>
    </div>
  );
}

function FindingCard({ finding }: { finding: InteractionFinding }) {
  // Findings that need action are open on arrival; the rest collapse to a
  // severity badge and summary line so long reports stay scannable.
  const [expanded, setExpanded] = useState(
    finding.severity === 'contraindicated' || finding.severity === 'major'
  );
  const styles = severityStyle(finding.severity);

  const meta = [
    finding.interaction_type ? TYPE_LABELS[finding.interaction_type] : null,
    finding.onset ? ONSET_LABELS[finding.onset] : null,
    finding.documentation ? `${finding.documentation} documentation` : null,
  ].filter(Boolean);

  // Show the matched rule scope only when a class stood in for a specific
  // drug, so the reader can see why the pair was flagged.
  const matchedViaClass =
    finding.matched_on.subject.kind === 'class' || finding.matched_on.object.kind === 'class';

  return (
    <article className={`break-inside-avoid rounded-lg border p-4 ${styles.card}`}>
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-1 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-wide ${styles.badge}`}
        >
          {finding.severity_label}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold leading-snug text-gray-900">
            {finding.drugs[0].name}
            <span className="mx-1 font-normal text-gray-400">+</span>
            {finding.drugs[1].name}
          </h4>
          <p className="mt-1 text-sm leading-snug text-gray-700">{finding.summary}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="mt-2 text-xs font-medium text-accent hover:underline print:hidden"
      >
        {expanded ? 'Hide detail' : 'Mechanism, management & monitoring'}
      </button>

      <div className={expanded ? 'block' : 'hidden print:block'}>
        <dl className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <Detail label="Mechanism">{finding.mechanism}</Detail>
          <Detail label="Effect">{finding.clinical_effect}</Detail>
          <Detail label="Management">{finding.management}</Detail>
          <Detail label="Monitoring">{finding.monitoring}</Detail>
          {matchedViaClass && (
            <Detail label="Matched as">
              {`${finding.matched_on.subject.label} with ${finding.matched_on.object.label}`}
            </Detail>
          )}
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 pt-2.5">
          {meta.length > 0 && (
            <span className="text-xs capitalize text-gray-400">{meta.join(' · ')}</span>
          )}
          {finding.references.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              {finding.references.map((ref) =>
                ref.url ? (
                  <a
                    key={ref.citation}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={ref.citation}
                    className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-200"
                  >
                    <Icon icon={Link01Icon} size={10} />
                    {ref.source}
                  </a>
                ) : (
                  <span
                    key={ref.citation}
                    title={ref.citation}
                    className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600"
                  >
                    {ref.source}
                  </span>
                )
              )}
            </span>
          )}
        </div>

        {finding.also_matched.length > 0 && (
          <ul className="mt-2.5 space-y-1 border-t border-gray-100 pt-2.5">
            {finding.also_matched.map((entry) => (
              <li key={entry.rule_key} className="flex items-start gap-2">
                <span
                  className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${severityStyle(entry.severity).dot}`}
                />
                <span className="text-xs leading-snug text-gray-500">{entry.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export default function InteractionReportView({ report }: { report: InteractionReport }) {
  const { summary } = report;
  const banner = severityStyle(summary.highest_severity);
  const clean = summary.finding_count === 0;

  const stats: [string, number][] = [
    ['Medicines', summary.medication_count],
    ['Pairs checked', summary.pair_count],
    ['Interactions', summary.finding_count],
    ['Cleared', summary.cleared_pair_count],
  ];

  return (
    <div className="space-y-3">
      <div className={`flex items-start gap-2 rounded-md border px-3 py-2.5 ${banner.banner}`}>
        <Icon
          icon={clean ? CheckmarkCircle02Icon : AlertCircleIcon}
          size={17}
          className="mt-0.5 shrink-0"
        />
        <p className="text-sm font-medium leading-snug">{summary.headline}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {stats.map(([label, value]) => (
          <span key={label} className="flex items-baseline gap-1.5 text-xs">
            <span className="font-semibold text-gray-900">{value}</span>
            <span className="text-gray-500">{label}</span>
          </span>
        ))}

        <span className="ml-auto flex flex-wrap gap-1.5">
          {(['contraindicated', 'major', 'moderate', 'minor'] as const)
            .filter((severity) => summary.severity_counts[severity] > 0)
            .map((severity) => (
              <span
                key={severity}
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_STYLES[severity].badge}`}
              >
                {summary.severity_counts[severity]} {SEVERITY_STYLES[severity].label}
              </span>
            ))}
        </span>
      </div>

      <Section title="Medicines reviewed" count={report.medications.length}>
        <ul className="divide-y divide-gray-100">
          {report.medications.map((medication) => (
            <li key={medication.key} className="flex flex-wrap items-baseline gap-x-2 py-1">
              <span className="text-sm font-medium text-gray-900">{medication.name}</span>
              {medication.drug_class && (
                <span className="text-xs text-gray-500">{medication.drug_class}</span>
              )}
              {medication.is_high_alert && (
                <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                  High alert
                </span>
              )}
              <span className="ml-auto font-mono text-xs text-gray-300">
                {medication.nhis_code}
                {medication.prescribing_level ? ` · ${medication.prescribing_level}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {report.findings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Interaction detail
            <span className="ml-1.5 font-normal text-gray-400">{report.findings.length}</span>
          </h3>
          {report.findings.map((finding) => (
            <FindingCard key={finding.rule_key + finding.drugs[0].key} finding={finding} />
          ))}
        </div>
      )}

      {report.monitoring_plan.length > 0 && (
        <Section title="Monitoring plan" hint="Consolidated from the interactions above.">
          <ul className="space-y-1.5">
            {report.monitoring_plan.map((item) => (
              <li key={item.pair} className="flex items-start gap-2">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${severityStyle(item.severity).dot}`}
                />
                <p className="text-sm leading-snug text-gray-600">
                  <span className="font-medium text-gray-900">{item.pair}</span>
                  {' — '}
                  {item.monitoring}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Recommended actions">
        <ol className="space-y-1.5">
          {report.recommendations.map((recommendation, index) => (
            <li key={recommendation} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
                {index + 1}
              </span>
              <p className="text-sm leading-snug text-gray-700">{recommendation}</p>
            </li>
          ))}
        </ol>
      </Section>

      {report.cleared_pairs.length > 0 && (
        <Section
          title="No known interaction"
          count={report.cleared_pairs.length}
          hint="Checked with no monograph found. Not positive evidence of safety."
        >
          <div className="flex flex-wrap gap-1.5">
            {report.cleared_pairs.map((pair) => (
              <span
                key={pair}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {pair}
              </span>
            ))}
          </div>
        </Section>
      )}

      <p className="text-xs text-gray-400">
        {report.reference} · generated {formatDateTime(report.generated_at)}
        {report.generated_by ? ` by ${report.generated_by}` : ''}
      </p>
    </div>
  );
}
