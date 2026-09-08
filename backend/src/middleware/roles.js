import { createUserClient } from '../lib/supabase.js';

const ROLE_PERMISSIONS = {
  admin: ['read', 'write', 'delete', 'audit', 'admin'],
  officer: ['read', 'write', 'delete', 'audit'],
  researcher: ['read', 'write', 'audit'],
  collaborator: ['read', 'write'],
  viewer: ['read'],
};

function isMissingTableError(error) {
  const message = error?.message || '';
  return (
    message.includes('Could not find the table') ||
    message.includes('relation') && message.includes('does not exist')
  );
}

function isPolicyRecursionError(error) {
  const message = error?.message || '';
  return message.includes('infinite recursion');
}

function createFallbackProfile(user) {
  return {
    id: 'pending',
    user_id: user.id,
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    role: 'officer',
    department: 'General',
    is_active: true,
  };
}

async function ensureProfile(supabase, user) {
  const { data: ensured, error: rpcError } = await supabase.rpc('ensure_user_profile');

  if (!rpcError && ensured) {
    return ensured;
  }

  const fullName =
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'User';

  const { data: inserted, error: insertError } = await supabase
    .from('user_profiles')
    .insert({
      user_id: user.id,
      full_name: fullName,
      role: 'officer',
      department: 'General',
    })
    .select()
    .single();

  if (!insertError && inserted) {
    return inserted;
  }

  return { error: rpcError || insertError };
}

export async function loadProfile(req, res, next) {
  try {
    const supabase = createUserClient(req.accessToken);

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (isPolicyRecursionError(error)) {
      return res.status(503).json({
        error:
          'Database policy error. Run supabase/security-policy-fix.sql in Supabase SQL Editor.',
        code: 'POLICY_RECURSION',
      });
    }

    if (isMissingTableError(error)) {
      req.profile = createFallbackProfile(req.user);
      req.permissions = ROLE_PERMISSIONS.officer;
      req.securitySetupPending = true;
      return next();
    }

    let activeProfile = profile;

    if (!activeProfile) {
      const result = await ensureProfile(supabase, req.user);

      if (result?.error) {
        if (isPolicyRecursionError(result.error)) {
          return res.status(503).json({
            error:
              'Database policy error. Run supabase/security-policy-fix.sql in Supabase SQL Editor.',
            code: 'POLICY_RECURSION',
          });
        }

        if (isMissingTableError(result.error)) {
          req.profile = createFallbackProfile(req.user);
          req.permissions = ROLE_PERMISSIONS.officer;
          req.securitySetupPending = true;
          return next();
        }

        return res.status(403).json({
          error:
            'User profile not found. Run supabase/profile-fix.sql in Supabase SQL Editor, or contact your system administrator.',
          code: 'PROFILE_MISSING',
        });
      }

      activeProfile = result;
    }

    if (!activeProfile.is_active) {
      return res.status(403).json({ error: 'Account deactivated. Contact your administrator.' });
    }

    req.profile = activeProfile;
    req.permissions = ROLE_PERMISSIONS[activeProfile.role] || ROLE_PERMISSIONS.viewer;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function requirePermission(...permissions) {
  return (req, res, next) => {
    const hasPermission = permissions.some((p) => req.permissions?.includes(p));
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions for this action.' });
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  next();
}

export function requireManageUsers(req, res, next) {
  const role = req.profile?.role;
  if (role !== 'admin' && role !== 'officer') {
    return res.status(403).json({ error: 'Admin or Officer access required.' });
  }
  next();
}
