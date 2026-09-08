import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
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
      .from('canonical_herbs')
      .select('*')
      .order('canonical_name', { ascending: true });

    if (error) {
      if (isMissingTable(error)) {
        return res.status(503).json({
          error: 'Herb tables not installed',
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

router.get('/:id', requirePermission('read'), async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('canonical_herbs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Herb not found' });

    res.json(data);
  } catch (err) {
    if (isMissingTable(err)) {
      return res.status(503).json({
        error: 'Herb tables not installed',
        hint: 'Run supabase/herbal-import.sql in the Supabase SQL Editor.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
