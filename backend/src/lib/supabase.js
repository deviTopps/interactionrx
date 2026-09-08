import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

export function isServiceKeyConfigured(key) {
  if (!key?.trim()) return false;
  const trimmed = key.trim();
  if (trimmed.includes('...')) return false;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false;
  if (trimmed.includes('/rest/v1')) return false;
  if (trimmed.length < 40) return false;
  if (trimmed.startsWith('eyJ') && trimmed.split('.').length !== 3) return false;
  return true;
}

if (supabaseServiceKey && !isServiceKeyConfigured(supabaseServiceKey)) {
  console.warn(
    '[InteractionRX] SUPABASE_SERVICE_ROLE_KEY looks invalid or incomplete. User management will fail until you paste the full secret from Supabase → Settings → API.'
  );
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY in environment'
  );
}

// Used to verify user JWTs from the Authorization header
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (optional — only needed for privileged server operations)
export const supabaseAdmin = isServiceKeyConfigured(supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey.trim())
  : null;

// User-scoped client (respects RLS when JWT is provided)
export function createUserClient(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
