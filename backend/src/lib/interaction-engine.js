// Drug-drug interaction matching and report generation.
//
// Rules are authored symmetrically against either an ingredient key or a class
// key. For each unordered pair of selected medicines the engine expands both
// drugs into their key sets (own key + class keys), matches rules in both
// directions, then keeps the single most relevant monograph for that pair —
// the way a clinical reference presents one entry per interacting pair rather
// than one per rule that happened to fire.

export const SEVERITY_RANK = {
  contraindicated: 4,
  major: 3,
  moderate: 2,
  minor: 1,
  unknown: 0,
};

const DOCUMENTATION_RANK = {
  excellent: 4,
  good: 3,
  fair: 2,
  theoretical: 1,
};

export const SEVERITY_LABELS = {
  contraindicated: 'Contraindicated',
  major: 'Major',
  moderate: 'Moderate',
  minor: 'Minor',
  unknown: 'Unknown',
};

// A rule naming both drugs explicitly is more informative than one matched
// through a class, so it wins when several rules describe the same pair.
function specificity(rule) {
  return (rule.subject_kind === 'drug' ? 1 : 0) + (rule.object_kind === 'drug' ? 1 : 0);
}

function ruleWeight(rule) {
  return [
    SEVERITY_RANK[rule.severity] ?? 0,
    specificity(rule),
    DOCUMENTATION_RANK[rule.documentation] ?? 0,
  ];
}

function isBetterRule(candidate, current) {
  const a = ruleWeight(candidate);
  const b = ruleWeight(current);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

function keySetFor(drug) {
  return new Set([drug.ingredient_key, ...(drug.classes || [])]);
}

function matchDirection(rule, subjectKeys, objectKeys) {
  return subjectKeys.has(rule.subject_key) && objectKeys.has(rule.object_key);
}

function describeSide(key, kind, classLabels) {
  return {
    kind,
    key,
    label: kind === 'class' ? classLabels[key] || key : key,
  };
}

/**
 * Match every unordered pair of the supplied drugs against the rule set.
 *
 * @param {Array} drugs   Drugs with `ingredient_key`, `generic_name`, `classes`
 * @param {Array} rules   Interaction rules from the database
 * @param {Object} classLabels  class_key -> display name
 * @returns {Array} one finding per interacting pair, highest severity first
 */
export function matchInteractions(drugs, rules, classLabels = {}) {
  const keySets = new Map(drugs.map((drug) => [drug.ingredient_key, keySetFor(drug)]));
  const findings = [];

  for (let i = 0; i < drugs.length; i += 1) {
    for (let j = i + 1; j < drugs.length; j += 1) {
      const drugA = drugs[i];
      const drugB = drugs[j];
      const keysA = keySets.get(drugA.ingredient_key);
      const keysB = keySets.get(drugB.ingredient_key);

      let best = null;
      let bestOrientation = null;
      const alsoMatched = [];

      for (const rule of rules) {
        const forward = matchDirection(rule, keysA, keysB);
        const reverse = !forward && matchDirection(rule, keysB, keysA);
        if (!forward && !reverse) continue;

        if (!best || isBetterRule(rule, best)) {
          if (best) alsoMatched.push(best);
          best = rule;
          bestOrientation = forward ? 'forward' : 'reverse';
        } else {
          alsoMatched.push(rule);
        }
      }

      if (!best) continue;

      // Orient the monograph so the subject side describes drug A.
      const [first, second] =
        bestOrientation === 'forward' ? [drugA, drugB] : [drugB, drugA];

      findings.push({
        rule_id: best.id,
        rule_key: best.rule_key,
        severity: best.severity,
        severity_label: SEVERITY_LABELS[best.severity] || best.severity,
        interaction_type: best.interaction_type,
        onset: best.onset,
        documentation: best.documentation,
        drugs: [
          { key: first.ingredient_key, name: first.generic_name, drug_class: first.drug_class },
          { key: second.ingredient_key, name: second.generic_name, drug_class: second.drug_class },
        ],
        matched_on: {
          subject: describeSide(best.subject_key, best.subject_kind, classLabels),
          object: describeSide(best.object_key, best.object_kind, classLabels),
        },
        summary: best.summary,
        mechanism: best.mechanism,
        clinical_effect: best.clinical_effect,
        management: best.management,
        monitoring: best.monitoring,
        references: best.evidence_refs || [],
        also_matched: alsoMatched
          .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))
          .slice(0, 3)
          .map((rule) => ({
            rule_key: rule.rule_key,
            severity: rule.severity,
            summary: rule.summary,
          })),
      });
    }
  }

  return findings.sort((a, b) => {
    const bySeverity = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
    if (bySeverity !== 0) return bySeverity;
    return a.drugs[0].name.localeCompare(b.drugs[0].name);
  });
}

function buildHeadline(severityCounts, highestSeverity, medicationCount) {
  if (highestSeverity === 'none') {
    return `No known interactions were identified between the ${medicationCount} selected medicines.`;
  }

  const parts = [];
  for (const severity of ['contraindicated', 'major', 'moderate', 'minor']) {
    const count = severityCounts[severity];
    if (count > 0) {
      parts.push(`${count} ${SEVERITY_LABELS[severity].toLowerCase()}`);
    }
  }

  const list = parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts[0];

  if (highestSeverity === 'contraindicated') {
    return `This combination includes a contraindicated pairing (${list}). Do not dispense as written until a prescriber has reviewed it.`;
  }
  if (highestSeverity === 'major') {
    return `This combination carries a major interaction risk (${list}). Prescriber review is required before dispensing.`;
  }
  return `${list} interaction${severityCounts.moderate + severityCounts.minor === 1 ? '' : 's'} identified. Review and counsel the patient before dispensing.`;
}

function buildRecommendations(findings, drugs, patientContext) {
  const recommendations = [];
  const hasSeverity = (severity) => findings.some((f) => f.severity === severity);

  if (hasSeverity('contraindicated')) {
    recommendations.push(
      'A contraindicated pairing was found. Withhold the affected medicine and contact the prescriber before dispensing.'
    );
  }
  if (hasSeverity('major')) {
    recommendations.push(
      'Major interactions require prescriber review. Document the clinical justification if the combination is continued, and put the recommended monitoring in place before the first dose.'
    );
  }

  const duplicates = findings.filter((f) => f.interaction_type === 'duplicate_therapy');
  if (duplicates.length > 0) {
    recommendations.push(
      `${duplicates.length} duplicate-therapy pairing${duplicates.length === 1 ? '' : 's'} detected. Confirm the overlap is intentional — if it is not, consolidate onto a single agent.`
    );
  }

  const absorption = findings.filter(
    (f) => f.interaction_type === 'pharmacokinetic' && /separat|hours (before|after|apart)/i.test(f.management || '')
  );
  if (absorption.length > 0) {
    recommendations.push(
      'Some interactions can be managed by dose separation alone. Give the patient explicit timing instructions rather than changing the regimen.'
    );
  }

  const highAlert = drugs.filter((drug) => drug.is_high_alert);
  if (highAlert.length > 0) {
    recommendations.push(
      `The regimen contains ${highAlert.length} high-alert medicine${highAlert.length === 1 ? '' : 's'} (${highAlert
        .map((drug) => drug.generic_name)
        .join(', ')}). Apply the local independent double-check before dispensing.`
    );
  }

  if (patientContext?.renal_impairment) {
    recommendations.push(
      'Renal impairment was recorded. Re-check dosing for all renally cleared agents and lower the threshold for biochemical monitoring.'
    );
  }
  if (patientContext?.hepatic_impairment) {
    recommendations.push(
      'Hepatic impairment was recorded. Metabolic interactions listed above will be more pronounced; reduce doses of hepatically cleared drugs accordingly.'
    );
  }
  if (patientContext?.pregnancy) {
    recommendations.push(
      'Pregnancy was recorded. Review each medicine for teratogenic risk in addition to the interactions listed here.'
    );
  }
  if (patientContext?.age && Number(patientContext.age) >= 65) {
    recommendations.push(
      'Patient is 65 or older. Sedative, anticholinergic and hypotensive burden accumulate in this group — consider deprescribing anything non-essential.'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'No action is required on interaction grounds. Continue routine counselling on adherence and adverse effects.'
    );
  }

  return recommendations;
}

function collectMonitoring(findings) {
  const seen = new Set();
  const items = [];

  for (const finding of findings) {
    if (!finding.monitoring) continue;
    const text = finding.monitoring.trim();
    const dedupeKey = text.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    items.push({
      severity: finding.severity,
      pair: finding.drugs.map((drug) => drug.name).join(' + '),
      monitoring: text,
    });
  }

  return items;
}

/**
 * Build the full standard interaction report for a set of selected medicines.
 */
export function generateReport({
  drugs,
  rules,
  classLabels = {},
  patientContext = {},
  reference,
  catalogSource,
  generatedBy,
}) {
  const findings = matchInteractions(drugs, rules, classLabels);

  const severityCounts = { contraindicated: 0, major: 0, moderate: 0, minor: 0 };
  for (const finding of findings) {
    if (finding.severity in severityCounts) severityCounts[finding.severity] += 1;
  }

  const highestSeverity =
    findings.length === 0
      ? 'none'
      : findings.reduce(
          (worst, finding) =>
            (SEVERITY_RANK[finding.severity] ?? 0) > (SEVERITY_RANK[worst] ?? 0)
              ? finding.severity
              : worst,
          'minor'
        );

  const pairCount = (drugs.length * (drugs.length - 1)) / 2;
  const interactingPairs = new Set(
    findings.map((finding) => finding.drugs.map((drug) => drug.key).sort().join('|'))
  );

  const clearedPairs = [];
  for (let i = 0; i < drugs.length; i += 1) {
    for (let j = i + 1; j < drugs.length; j += 1) {
      const key = [drugs[i].ingredient_key, drugs[j].ingredient_key].sort().join('|');
      if (!interactingPairs.has(key)) {
        clearedPairs.push(`${drugs[i].generic_name} + ${drugs[j].generic_name}`);
      }
    }
  }

  return {
    reference,
    generated_at: new Date().toISOString(),
    generated_by: generatedBy || null,
    medications: drugs.map((drug) => ({
      key: drug.ingredient_key,
      name: drug.generic_name,
      drug_class: drug.drug_class,
      dosage_forms: drug.dosage_forms || [],
      prescribing_level: drug.prescribing_level,
      nhis_code: drug.nhis_code,
      is_high_alert: Boolean(drug.is_high_alert),
    })),
    patient_context: patientContext,
    summary: {
      medication_count: drugs.length,
      pair_count: pairCount,
      finding_count: findings.length,
      cleared_pair_count: clearedPairs.length,
      highest_severity: highestSeverity,
      severity_counts: severityCounts,
      headline: buildHeadline(severityCounts, highestSeverity, drugs.length),
    },
    findings,
    cleared_pairs: clearedPairs,
    monitoring_plan: collectMonitoring(findings),
    recommendations: buildRecommendations(findings, drugs, patientContext),
    sources: {
      drug_catalog: catalogSource,
      knowledge_base: 'InteractionRX drug-drug interaction knowledge base',
      rules_evaluated: rules.length,
      references: [
        'British National Formulary — Appendix 1: Interactions',
        "Stockley's Drug Interactions, Pharmaceutical Press",
        'DrugBank Online interaction monographs',
        'Standard Treatment Guidelines, Ministry of Health, Ghana',
      ],
    },
    disclaimer:
      'This report is a clinical decision support aid compiled from published interaction references. It does not replace the professional judgement of the prescriber or dispensing pharmacist, and the absence of a listed interaction does not guarantee that a combination is safe.',
  };
}

export function buildReference(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `IRX-DDI-${stamp}-${random}`;
}
