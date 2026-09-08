import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { authenticate } from '../middleware/auth.js';
import { loadProfile, requirePermission } from '../middleware/roles.js';

const router = Router();

router.use(authenticate);
router.use(loadProfile);

function isMissingTable(error) {
  const message = error?.message || '';
  return (
    message.includes('Could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}

router.get('/', requirePermission('read'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('interactions')
      .select(`
        *,
        canonical_herbs (id, canonical_name, latin_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTable(error)) {
        return res.status(503).json({
          error: 'Interaction tables not installed',
          hint: 'Run supabase/herbal-import.sql in the Supabase SQL Editor.',
        });
      }
      throw error;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('write'), async (req, res) => {
  try {
    const {
      herb_name,
      canonical_herb_id,
      active_compound,
      drug_or_class,
      interaction_type,
      severity,
      summary,
      evidence_quote,
      confidence,
    } = req.body;

    if (!herb_name?.trim() || !drug_or_class?.trim()) {
      return res.status(400).json({ error: 'Herb name and drug/class are required' });
    }

    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('interactions')
      .insert({
        herb_name: herb_name.trim(),
        canonical_herb_id: canonical_herb_id || null,
        active_compound: active_compound?.trim() || null,
        drug_or_class: drug_or_class.trim(),
        interaction_type: interaction_type?.trim() || null,
        severity: severity || 'unknown',
        summary: summary?.trim() || null,
        evidence_quote: evidence_quote?.trim() || null,
        confidence: confidence ?? null,
        review_status: 'pending',
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit(supabase, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'CREATE',
      entityType: 'interaction',
      entityId: data.id,
      entityName: `${data.herb_name} + ${data.drug_or_class}`,
      ipAddress: req.ip,
    });

    res.status(201).json(data);
  } catch (err) {
    if (isMissingTable(err)) {
      return res.status(503).json({
        error: 'Interaction tables not installed',
        hint: 'Run supabase/herbal-import.sql in the Supabase SQL Editor.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/review', requirePermission('write'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid review status' });
    }

    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('interactions')
      .update({
        review_status: status,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await logAudit(supabase, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'REVIEW',
      entityType: 'interaction',
      entityId: data.id,
      entityName: `${data.herb_name} → ${status}`,
      ipAddress: req.ip,
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
