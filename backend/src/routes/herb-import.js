import { randomUUID } from 'crypto';
import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { authenticate } from '../middleware/auth.js';
import { loadProfile, requirePermission } from '../middleware/roles.js';
import { runHerbScrapers } from '../services/scrapers/run.js';

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
    const status = req.query.status || 'pending';

    let query = supabase
      .from('imported_herbs')
      .select('*')
      .order('scraped_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('import_status', status);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingTable(error)) {
        return res.status(503).json({
          error: 'Import tables not installed',
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

router.post('/submit', requirePermission('read'), async (req, res) => {
  try {
    const { name, variant_name, latin_name, description, image_url, image_file_name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Herb name is required' });
    }
    if (!image_url?.trim()) {
      return res.status(400).json({ error: 'Herb photo is required' });
    }

    const supabase = createUserClient(req.accessToken);
    const sourceId = randomUUID();
    const trimmedVariant = variant_name?.trim() || null;
    const trimmedName = name.trim();

    const { data, error } = await supabase
      .from('imported_herbs')
      .insert({
        name: trimmedName,
        variant_name: trimmedVariant,
        latin_name: latin_name?.trim() || null,
        description: description?.trim() || null,
        origin: 'User submission',
        source_type: 'user_submission',
        source_id: sourceId,
        image_url: image_url.trim(),
        image_file_name: image_file_name?.trim() || null,
        submitted_by: req.user.id,
        import_status: 'pending',
        raw_metadata: { submitted_at: new Date().toISOString() },
      })
      .select()
      .single();

    if (error) {
      if (isMissingTable(error)) {
        return res.status(503).json({
          error: 'Herb submission tables not installed',
          hint: 'Run supabase/herb-submissions.sql in the Supabase SQL Editor.',
        });
      }
      throw error;
    }

    await logAudit(supabase, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'SUBMIT',
      entityType: 'imported_herbs',
      entityId: data.id,
      entityName: trimmedVariant ? `${trimmedName} (${trimmedVariant})` : trimmedName,
      ipAddress: req.ip,
    });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/scrape', requirePermission('write'), async (req, res) => {
  try {
    const sources = req.body?.sources || ['pubmed', 'wikidata'];
    const { records, errors, stats } = await runHerbScrapers({ sources });

    if (!records.length && errors.length) {
      return res.status(502).json({
        error: 'All scrapers failed',
        errors,
      });
    }

    const supabase = createUserClient(req.accessToken);
    const upserted = [];

    for (const record of records) {
      const { data, error } = await supabase
        .from('imported_herbs')
        .upsert(
          {
            name: record.name,
            latin_name: record.latin_name,
            description: record.description,
            composition: record.composition,
            origin: record.origin,
            source_type: record.source_type,
            source_id: record.source_id,
            source_url: record.source_url,
            raw_metadata: record.raw_metadata,
            scraped_at: new Date().toISOString(),
          },
          { onConflict: 'source_type,source_id' }
        )
        .select()
        .single();

      if (!error && data) {
        upserted.push(data);
      } else if (error && !isMissingTable(error)) {
        console.warn('Upsert failed:', record.source_id, error.message);
      }
    }

    if (upserted.length === 0 && records.length > 0) {
      const { error: tableError } = await supabase.from('imported_herbs').select('id').limit(1);
      if (tableError && isMissingTable(tableError)) {
        return res.status(503).json({
          error: 'Import tables not installed',
          hint: 'Run supabase/herbal-import.sql in the Supabase SQL Editor.',
          scraped: stats,
        });
      }
    }

    await logAudit(supabase, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'SCRAPE',
      entityType: 'imported_herbs',
      entityName: `Scraped ${upserted.length} herbs`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      stats,
      errors,
      upserted: upserted.length,
      records: upserted,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/approve', requirePermission('write'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const { data: imported, error: fetchError } = await supabase
      .from('imported_herbs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;
    if (!imported) return res.status(404).json({ error: 'Imported herb not found' });
    if (imported.import_status === 'approved' && imported.canonical_herb_id) {
      return res.status(400).json({ error: 'Already added to herb catalog' });
    }

    const description =
      imported.description?.trim() ||
      `Discovered from ${imported.source_type}. See source for details.`;

    const catalogName = imported.variant_name
      ? `${imported.name} (${imported.variant_name})`
      : imported.name;

    let herbId = imported.canonical_herb_id;

    const { data: existing } = await supabase
      .from('canonical_herbs')
      .select('id')
      .ilike('canonical_name', catalogName)
      .maybeSingle();

    if (existing) {
      herbId = existing.id;
    } else {
      const { data: herb, error: herbError } = await supabase
        .from('canonical_herbs')
        .insert({
          canonical_name: catalogName,
          latin_name: imported.latin_name,
          description,
          image_url: imported.image_url || null,
          wikidata_id: imported.source_type === 'wikidata' ? imported.source_id : null,
        })
        .select()
        .single();

      if (herbError) throw herbError;
      herbId = herb.id;
    }

    const { error: updateError } = await supabase
      .from('imported_herbs')
      .update({
        import_status: 'approved',
        canonical_herb_id: herbId,
      })
      .eq('id', imported.id);

    if (updateError) throw updateError;

    const { data: herb, error: herbFetchError } = await supabase
      .from('canonical_herbs')
      .select('*')
      .eq('id', herbId)
      .single();

    if (herbFetchError) throw herbFetchError;

    await logAudit(supabase, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'APPROVE',
      entityType: 'herb',
      entityId: herb.id,
      entityName: herb.canonical_name,
      ipAddress: req.ip,
    });

    res.status(201).json({ herb, imported_id: imported.id });
  } catch (err) {
    if (isMissingTable(err)) {
      return res.status(503).json({
        error: 'Import tables not installed',
        hint: 'Run supabase/herbal-import.sql in the Supabase SQL Editor.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

/** @deprecated Use POST /:id/approve — herbs are not herbal medicines */
router.post('/:id/import', requirePermission('write'), (_req, res) => {
  res.status(410).json({
    error: 'Herbs and herbal medicines are separate. Use POST /:id/approve to add to the herb catalog.',
  });
});

router.post('/:id/dismiss', requirePermission('write'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('imported_herbs')
      .update({ import_status: 'dismissed' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
