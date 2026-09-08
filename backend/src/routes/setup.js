import { Router } from 'express';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAuth, supabaseAdmin, isServiceKeyConfigured } from '../lib/supabase.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function migrationsAllowed(_req, res, next) {
  const allow =
    process.env.ALLOW_SETUP_MIGRATIONS === 'true' ||
    process.env.NODE_ENV !== 'production';

  if (!allow) {
    return res.status(403).json({
      error: 'Setup migrations are disabled in production.',
      hint: 'Run SQL from the supabase/ folder in the Supabase SQL Editor, or set ALLOW_SETUP_MIGRATIONS=true.',
    });
  }

  next();
}

router.get('/status', async (_req, res) => {
  const { error: medicinesError } = await supabaseAuth
    .from('herbal_medicines')
    .select('id')
    .limit(1);

  if (medicinesError?.message?.includes('Could not find the table')) {
    return res.json({
      ready: false,
      needsSetup: true,
      needsSecuritySetup: false,
    });
  }

  if (medicinesError) {
    return res.json({ ready: false, needsSetup: false, error: medicinesError.message });
  }

  const { error: profilesError } = await supabaseAuth
    .from('user_profiles')
    .select('id')
    .limit(1);

  if (profilesError?.message?.includes('Could not find the table')) {
    return res.json({
      ready: false,
      needsSetup: false,
      needsSecuritySetup: true,
    });
  }

  res.json({ ready: true });
});

router.get('/user-management-status', (_req, res) => {
  const rawKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    '';

  if (!rawKey.trim()) {
    return res.json({
      configured: false,
      reason: 'missing',
      message: 'SUPABASE_SERVICE_ROLE_KEY is empty in backend/.env',
    });
  }

  if (!isServiceKeyConfigured(rawKey)) {
    return res.json({
      configured: false,
      reason: 'invalid',
      message:
        'SUPABASE_SERVICE_ROLE_KEY looks invalid or incomplete. Paste the full secret from Supabase → Settings → API.',
    });
  }

  if (!supabaseAdmin) {
    return res.json({
      configured: false,
      reason: 'not_loaded',
      message: 'Service key is set but the backend has not loaded it yet. Restart the backend.',
    });
  }

  res.json({ configured: true });
});

const ROLE_PROBE_USER_ID = '00000000-0000-0000-0000-000000000001';

async function checkUserRolesExpansionApplied() {
  if (!supabaseAdmin) {
    return { applied: false, reason: 'service_key_missing' };
  }

  const { error } = await supabaseAdmin.from('user_profiles').insert({
    user_id: ROLE_PROBE_USER_ID,
    full_name: '__role_expansion_probe__',
    role: 'collaborator',
    department: 'General',
    is_active: false,
  });

  if (!error) {
    await supabaseAdmin.from('user_profiles').delete().eq('user_id', ROLE_PROBE_USER_ID);
    return { applied: true };
  }

  const message = error.message.toLowerCase();

  if (
    message.includes('user_profiles_role_check') ||
    message.includes('violates check constraint')
  ) {
    return { applied: false, reason: 'constraint' };
  }

  if (message.includes('foreign key') || message.includes('violates foreign key constraint')) {
    return { applied: true };
  }

  if (message.includes('could not find the table')) {
    return { applied: false, reason: 'missing_profiles_table' };
  }

  return { applied: false, reason: 'unknown', message: error.message };
}

router.get('/user-roles-status', async (_req, res) => {
  try {
    const result = await checkUserRolesExpansionApplied();
    res.json({
      applied: result.applied,
      reason: result.reason,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({ applied: false, error: err.message });
  }
});

router.get('/security-sql', (_req, res) => {
  const securityPath = path.join(__dirname, '../../../supabase/security.sql');
  const sql = fs.readFileSync(securityPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.get('/profile-fix-sql', (_req, res) => {
  const fixPath = path.join(__dirname, '../../../supabase/profile-fix.sql');
  const sql = fs.readFileSync(fixPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.get('/medicine-files-sql', (_req, res) => {
  const filesPath = path.join(__dirname, '../../../supabase/medicine-files.sql');
  const sql = fs.readFileSync(filesPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.get('/herbal-import-sql', (_req, res) => {
  const importPath = path.join(__dirname, '../../../supabase/herbal-import.sql');
  const sql = fs.readFileSync(importPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.get('/user-roles-expansion-sql', (_req, res) => {
  const sqlPath = path.join(__dirname, '../../../supabase/user-roles-expansion.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.get('/herb-submissions-sql', (_req, res) => {
  const sqlPath = path.join(__dirname, '../../../supabase/herb-submissions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.get('/herbs-separate-migration-sql', (_req, res) => {
  const migrationPath = path.join(__dirname, '../../../supabase/herbs-separate-migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.get('/move-herbs-out-of-medicines-sql', (_req, res) => {
  const migrationPath = path.join(__dirname, '../../../supabase/move-herbs-out-of-medicines.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.get('/drug-interactions-sql', (_req, res) => {
  const sqlPath = path.join(__dirname, '../../../supabase/drug-interactions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.post('/migrate-drug-interactions', migrationsAllowed, async (_req, res) => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return res.status(400).json({
      error: 'DATABASE_URL not configured in backend/.env',
      hint: 'Run supabase/drug-interactions.sql manually in the Supabase SQL Editor.',
    });
  }

  const sqlPath = path.join(__dirname, '../../../supabase/drug-interactions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    res.json({ success: true, message: 'Drug interaction tables created.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

router.get('/security-policy-fix-sql', (_req, res) => {
  const fixPath = path.join(__dirname, '../../../supabase/security-policy-fix.sql');
  const sql = fs.readFileSync(fixPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.post('/migrate-user-roles', migrationsAllowed, async (_req, res) => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return res.status(400).json({
      error: 'DATABASE_URL not configured in backend/.env',
      hint: 'Run supabase/user-roles-expansion.sql manually in the Supabase SQL Editor.',
    });
  }

  const sqlPath = path.join(__dirname, '../../../supabase/user-roles-expansion.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    res.json({ success: true, message: 'User role expansion applied.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

router.post('/migrate-security', migrationsAllowed, async (_req, res) => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return res.status(400).json({
      error: 'DATABASE_URL not configured in backend/.env',
      hint: 'Add your Supabase database connection string, then retry.',
    });
  }

  const securityPath = path.join(__dirname, '../../../supabase/security.sql');
  const sql = fs.readFileSync(securityPath, 'utf8');

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    res.json({ success: true, message: 'Security tables created.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

router.post('/migrate', migrationsAllowed, async (_req, res) => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return res.status(400).json({
      error: 'DATABASE_URL not configured in backend/.env',
      hint: 'Add your Supabase database connection string, then retry.',
    });
  }

  const schemaPath = path.join(__dirname, '../../../supabase/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    res.json({ success: true, message: 'Database tables created.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
});

export default router;
