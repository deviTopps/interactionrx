import { Router } from 'express';
import { supabaseAdmin, isServiceKeyConfigured } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { authenticate } from '../middleware/auth.js';
import { loadProfile, requireManageUsers } from '../middleware/roles.js';

const router = Router();

const ASSIGNABLE_ROLES = ['admin', 'officer', 'researcher', 'collaborator'];

function assignableRolesForActor(actorRole) {
  if (actorRole === 'admin') return ASSIGNABLE_ROLES;
  if (actorRole === 'officer') return ['officer', 'researcher', 'collaborator'];
  return [];
}

router.use(authenticate);
router.use(loadProfile);
router.use(requireManageUsers);

function isValidServiceKey(key) {
  return isServiceKeyConfigured(key);
}

function formatSupabaseKeyError(err) {
  const message = err?.message || '';
  if (message.toLowerCase().includes('invalid api key')) {
    return 'Invalid API key. Paste the full service_role / secret key from Supabase → Settings → API into backend/.env (not the example text with ...).';
  }
  return message;
}

function formatUserCreateError(err) {
  const message = err?.message || '';
  const lower = message.toLowerCase();

  if (lower.includes('database error creating new user')) {
    return 'Database error while creating the user. Run supabase/user-roles-expansion.sql in the Supabase SQL Editor, then try again.';
  }
  if (
    lower.includes('user_profiles_role_check') ||
    lower.includes('check constraint') ||
    lower.includes('violates check constraint')
  ) {
    return 'That user type is not allowed in the database yet. Run supabase/user-roles-expansion.sql in the Supabase SQL Editor.';
  }
  if (lower.includes('already been registered') || lower.includes('already exists')) {
    return 'A user with this email already exists.';
  }

  return formatSupabaseKeyError(err);
}

function adminClientRequired(res) {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseAdmin) {
    if (key && !isValidServiceKey(key)) {
      res.status(503).json({
        error:
          'SUPABASE_SERVICE_ROLE_KEY is invalid or incomplete. Copy the entire secret from Supabase → Settings → API (sb_secret_... or full eyJ JWT — do not use placeholder text with ...).',
      });
      return false;
    }

    res.status(503).json({
      error: 'User management requires SUPABASE_SERVICE_ROLE_KEY in backend/.env',
    });
    return false;
  }
  return true;
}

async function listAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...(data.users || []));
    if ((data.users || []).length < perPage) break;
    page += 1;
  }

  return users;
}

router.get('/', async (req, res) => {
  try {
    if (!adminClientRequired(res)) return;

    const [{ data: profiles, error: profileError }, authUsers] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('*').order('created_at', { ascending: false }),
      listAuthUsers(),
    ]);

    if (profileError) throw profileError;

    const emailById = new Map(authUsers.map((user) => [user.id, user.email]));

    const users = (profiles || []).map((profile) => ({
      ...profile,
      email: emailById.get(profile.user_id) || null,
    }));

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: formatSupabaseKeyError(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!adminClientRequired(res)) return;

    const { email, password, full_name, role, department } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!full_name?.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role selected' });
    }
    if (!assignableRolesForActor(req.profile?.role).includes(role)) {
      return res.status(403).json({ error: 'You cannot assign this user type' });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        department: department?.trim() || 'General',
      },
    });

    if (createError) throw createError;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          user_id: created.user.id,
          full_name: full_name.trim(),
          role,
          department: department?.trim() || 'General',
          is_active: true,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw profileError;
    }

    await logAudit(supabaseAdmin, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'CREATE',
      entityType: 'user',
      entityId: created.user.id,
      entityName: full_name.trim(),
      ipAddress: req.ip,
    });

    res.status(201).json({
      ...profile,
      email: created.user.email,
    });
  } catch (err) {
    res.status(500).json({ error: formatUserCreateError(err) });
  }
});

router.patch('/:userId', async (req, res) => {
  try {
    if (!adminClientRequired(res)) return;

    const { full_name, role, department, is_active } = req.body;
    const updates = {};

    if (full_name !== undefined) updates.full_name = full_name?.trim() || null;
    if (department !== undefined) updates.department = department?.trim() || 'General';
    if (is_active !== undefined) updates.is_active = Boolean(is_active);
    if (role !== undefined) {
      if (!assignableRolesForActor(req.profile?.role).includes(role)) {
        return res.status(403).json({ error: 'You cannot assign this user type' });
      }
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('user_id', req.params.userId)
      .select()
      .single();

    if (error) throw error;

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(req.params.userId);

    res.json({
      ...profile,
      email: authUser?.user?.email || null,
    });
  } catch (err) {
    res.status(500).json({ error: formatSupabaseKeyError(err) });
  }
});

export default router;
