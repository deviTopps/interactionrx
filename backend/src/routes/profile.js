import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { loadProfile } from '../middleware/roles.js';

const router = Router();

router.use(authenticate);
router.use(loadProfile);

router.get('/me', (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
    },
    profile: req.profile,
    permissions: req.permissions,
    securitySetupPending: Boolean(req.securitySetupPending),
  });
});

router.patch('/me', async (req, res) => {
  try {
    const { full_name, department } = req.body;
    const supabase = createUserClient(req.accessToken);
    const updates = {};

    if (full_name !== undefined) updates.full_name = full_name?.trim() || null;
    if (department !== undefined) updates.department = department?.trim() || 'General';

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
      },
      profile: data,
      permissions: req.permissions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
