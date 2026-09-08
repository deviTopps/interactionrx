import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { loadProfile, requirePermission } from '../middleware/roles.js';

const router = Router();

router.use(authenticate);
router.use(loadProfile);
router.use(requirePermission('audit'));

router.get('/', async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
