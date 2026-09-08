import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { authenticate } from '../middleware/auth.js';
import { loadProfile, requirePermission } from '../middleware/roles.js';
import { buildReference, generateReport, SEVERITY_RANK } from '../lib/interaction-engine.js';
import { CATALOG_SOURCE, DRUGS, DRUG_CLASSES } from '../data/nhis-drugs.js';
import { INTERACTION_RULES } from '../data/drug-interaction-rules.js';

const router = Router();

router.use(authenticate);
router.use(loadProfile);

const SETUP_HINT = 'Run supabase/drug-interactions.sql in the Supabase SQL Editor.';
const MAX_MEDICATIONS = 25;
const STAFF_ROLES = ['admin', 'officer', 'researcher'];

function isMissingTable(error) {
  const message = error?.message || '';
  return (
    message.includes('Could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}

function setupRequired(res) {
  return res.status(503).json({ error: 'Drug interaction tables not installed', hint: SETUP_HINT });
}

function requireStaff(req, res, next) {
  if (!STAFF_ROLES.includes(req.profile?.role)) {
    return res.status(403).json({
      error: 'Only admins, officers and researchers can load the drug catalog',
    });
  }
  next();
}

// `class:nsaid` in the rule data becomes { kind: 'class', key: 'nsaid' } in the row.
function parseRuleSide(value) {
  if (value.startsWith('class:')) {
    return { kind: 'class', key: value.slice('class:'.length) };
  }
  return { kind: 'drug', key: value };
}

function ruleKeyFor(rule) {
  return `${rule.subject}__${rule.object}`.replace(/:/g, '-');
}

function toDrugRow(drug) {
  return {
    ingredient_key: drug.key,
    generic_name: drug.name,
    drug_class: drug.drug_class || null,
    nhis_code: drug.nhis_code || null,
    dosage_forms: drug.forms || [],
    prescribing_level: drug.level || null,
    is_high_alert: Boolean(drug.high_alert),
    source: CATALOG_SOURCE,
    is_active: true,
  };
}

function toRuleRow(rule, userId) {
  const subject = parseRuleSide(rule.subject);
  const object = parseRuleSide(rule.object);

  return {
    rule_key: ruleKeyFor(rule),
    subject_key: subject.key,
    subject_kind: subject.kind,
    object_key: object.key,
    object_kind: object.kind,
    severity: rule.severity,
    interaction_type: rule.type || null,
    onset: rule.onset || null,
    documentation: rule.documentation || null,
    summary: rule.summary,
    mechanism: rule.mechanism || null,
    clinical_effect: rule.clinical_effect || null,
    management: rule.management || null,
    monitoring: rule.monitoring || null,
    evidence_refs: rule.refs || [],
    review_status: 'approved',
    created_by: userId,
  };
}

// Attach the class keys each drug belongs to — this is what rule matching needs.
function withClasses(rows) {
  return (rows || []).map((row) => ({
    ...row,
    classes: (row.drug_class_members || []).map((member) => member.class_key),
    drug_class_members: undefined,
  }));
}

async function loadClassLabels(supabase) {
  const { data, error } = await supabase.from('drug_classes').select('class_key, name');
  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.class_key, row.name]));
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
router.get('/catalog', requirePermission('read'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const [drugsResult, classesResult, ruleCountResult] = await Promise.all([
      supabase
        .from('drugs')
        .select('*, drug_class_members (class_key)')
        .eq('is_active', true)
        .order('generic_name'),
      supabase.from('drug_classes').select('*').order('name'),
      supabase.from('drug_interactions').select('id', { count: 'exact', head: true }),
    ]);

    if (drugsResult.error) {
      if (isMissingTable(drugsResult.error)) return setupRequired(res);
      throw drugsResult.error;
    }
    if (classesResult.error) throw classesResult.error;

    const drugs = withClasses(drugsResult.data);

    res.json({
      catalog_source: CATALOG_SOURCE,
      drug_count: drugs.length,
      rule_count: ruleCountResult.count || 0,
      needs_seed: drugs.length === 0 || (ruleCountResult.count || 0) === 0,
      available_drugs_in_bundle: DRUGS.length,
      available_rules_in_bundle: INTERACTION_RULES.length,
      classes: classesResult.data || [],
      drugs,
    });
  } catch (err) {
    if (isMissingTable(err)) return setupRequired(res);
    res.status(500).json({ error: err.message });
  }
});

// Load the bundled NHIS catalog and rule base into the database. Idempotent —
// re-running picks up additions and edits to the bundled data files.
router.post('/sync-catalog', requirePermission('write'), requireStaff, async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const { error: classError } = await supabase
      .from('drug_classes')
      .upsert(DRUG_CLASSES, { onConflict: 'class_key' });

    if (classError) {
      if (isMissingTable(classError)) return setupRequired(res);
      throw classError;
    }

    const { error: drugError } = await supabase
      .from('drugs')
      .upsert(DRUGS.map(toDrugRow), { onConflict: 'ingredient_key' });

    if (drugError) throw drugError;

    const { data: storedDrugs, error: fetchError } = await supabase
      .from('drugs')
      .select('id, ingredient_key');

    if (fetchError) throw fetchError;

    const drugIdByKey = new Map((storedDrugs || []).map((row) => [row.ingredient_key, row.id]));

    const memberRows = [];
    for (const drug of DRUGS) {
      const drugId = drugIdByKey.get(drug.key);
      if (!drugId) continue;
      for (const classKey of drug.classes || []) {
        memberRows.push({ drug_id: drugId, class_key: classKey });
      }
    }

    if (memberRows.length > 0) {
      const { error: memberError } = await supabase
        .from('drug_class_members')
        .upsert(memberRows, { onConflict: 'drug_id,class_key' });

      if (memberError) throw memberError;
    }

    const { error: ruleError } = await supabase
      .from('drug_interactions')
      .upsert(
        INTERACTION_RULES.map((rule) => toRuleRow(rule, req.user.id)),
        { onConflict: 'rule_key' }
      );

    if (ruleError) throw ruleError;

    await logAudit(supabase, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'SYNC',
      entityType: 'drug_catalog',
      entityName: CATALOG_SOURCE,
      details: {
        drugs: DRUGS.length,
        classes: DRUG_CLASSES.length,
        class_memberships: memberRows.length,
        rules: INTERACTION_RULES.length,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      catalog_source: CATALOG_SOURCE,
      drugs: DRUGS.length,
      classes: DRUG_CLASSES.length,
      class_memberships: memberRows.length,
      rules: INTERACTION_RULES.length,
    });
  } catch (err) {
    if (isMissingTable(err)) return setupRequired(res);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Interaction check — the core of the feature
// ---------------------------------------------------------------------------
router.post('/check', requirePermission('read'), async (req, res) => {
  try {
    const { drug_keys, patient_context, save = true } = req.body;

    if (!Array.isArray(drug_keys)) {
      return res.status(400).json({ error: 'drug_keys must be an array of drug identifiers' });
    }

    const keys = [...new Set(drug_keys.map((key) => String(key).trim()).filter(Boolean))];

    if (keys.length < 2) {
      return res.status(400).json({ error: 'Select at least two medications to check' });
    }
    if (keys.length > MAX_MEDICATIONS) {
      return res
        .status(400)
        .json({ error: `A single check is limited to ${MAX_MEDICATIONS} medications` });
    }

    const supabase = createUserClient(req.accessToken);

    const { data: drugRows, error: drugError } = await supabase
      .from('drugs')
      .select('*, drug_class_members (class_key)')
      .in('ingredient_key', keys);

    if (drugError) {
      if (isMissingTable(drugError)) return setupRequired(res);
      throw drugError;
    }

    const drugs = withClasses(drugRows);

    if (drugs.length < 2) {
      const found = new Set(drugs.map((drug) => drug.ingredient_key));
      const missing = keys.filter((key) => !found.has(key));
      return res.status(400).json({
        error:
          drugs.length === 0
            ? 'None of the selected medications were found in the catalog'
            : `Not found in the catalog: ${missing.join(', ')}`,
      });
    }

    // Only rules touching a selected drug or one of its classes can match.
    const candidateKeys = [
      ...new Set(drugs.flatMap((drug) => [drug.ingredient_key, ...drug.classes])),
    ];

    const { data: ruleRows, error: ruleError } = await supabase
      .from('drug_interactions')
      .select('*')
      .eq('review_status', 'approved')
      .in('subject_key', candidateKeys);

    if (ruleError) throw ruleError;

    const rules = (ruleRows || []).filter((rule) => candidateKeys.includes(rule.object_key));
    const classLabels = await loadClassLabels(supabase);

    const reference = buildReference();
    const report = generateReport({
      drugs,
      rules,
      classLabels,
      patientContext: patient_context || {},
      reference,
      catalogSource: CATALOG_SOURCE,
      generatedBy: req.profile?.full_name || req.user.email,
    });

    let checkId = null;

    if (save) {
      const { data: saved, error: saveError } = await supabase
        .from('interaction_checks')
        .insert({
          reference,
          drug_keys: drugs.map((drug) => drug.ingredient_key),
          drug_names: drugs.map((drug) => drug.generic_name),
          highest_severity: report.summary.highest_severity,
          finding_count: report.summary.finding_count,
          report,
          patient_context: patient_context || {},
          created_by: req.user.id,
        })
        .select('id')
        .single();

      if (saveError) throw saveError;
      checkId = saved.id;

      await logAudit(supabase, {
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'CHECK',
        entityType: 'interaction_check',
        entityId: checkId,
        entityName: reference,
        details: {
          medications: report.summary.medication_count,
          findings: report.summary.finding_count,
          highest_severity: report.summary.highest_severity,
        },
        ipAddress: req.ip,
      });
    }

    res.json({ id: checkId, report });
  } catch (err) {
    if (isMissingTable(err)) return setupRequired(res);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Saved reports
// ---------------------------------------------------------------------------
router.get('/checks', requirePermission('read'), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('interaction_checks')
      .select('id, reference, drug_names, highest_severity, finding_count, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTable(error)) return setupRequired(res);
      throw error;
    }

    res.json(data || []);
  } catch (err) {
    if (isMissingTable(err)) return setupRequired(res);
    res.status(500).json({ error: err.message });
  }
});

router.get('/checks/:id', requirePermission('read'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('interaction_checks')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (isMissingTable(error)) return setupRequired(res);
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Report not found' });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/checks/:id', requirePermission('read'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const { error } = await supabase.from('interaction_checks').delete().eq('id', req.params.id);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Rule browser (reference view of the knowledge base)
// ---------------------------------------------------------------------------
router.get('/rules', requirePermission('read'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('drug_interactions')
      .select('*')
      .eq('review_status', 'approved');

    if (error) {
      if (isMissingTable(error)) return setupRequired(res);
      throw error;
    }

    const classLabels = await loadClassLabels(supabase);

    const rules = (data || [])
      .map((rule) => ({
        ...rule,
        subject_label: rule.subject_kind === 'class' ? classLabels[rule.subject_key] || rule.subject_key : rule.subject_key,
        object_label: rule.object_kind === 'class' ? classLabels[rule.object_key] || rule.object_key : rule.object_key,
      }))
      .sort(
        (a, b) =>
          (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
          a.subject_label.localeCompare(b.subject_label)
      );

    res.json(rules);
  } catch (err) {
    if (isMissingTable(err)) return setupRequired(res);
    res.status(500).json({ error: err.message });
  }
});

export default router;
