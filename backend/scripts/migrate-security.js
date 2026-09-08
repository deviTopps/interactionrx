import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrateSecurity() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error(
      'Missing DATABASE_URL in backend/.env\n\n' +
        '1. Open Supabase Dashboard → Project Settings → Database\n' +
        '2. Copy the Connection string (URI)\n' +
        '3. Add to backend/.env: DATABASE_URL=postgresql://...\n' +
        '4. Run: npm run db:security\n\n' +
        'Or run supabase/security.sql manually in the Supabase SQL Editor.'
    );
    process.exit(1);
  }

  const securityPath = path.join(__dirname, '../../supabase/security.sql');
  const sql = fs.readFileSync(securityPath, 'utf8');

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database. Running security schema...');
    await client.query(sql);
    console.log('✓ Security tables created successfully.');
  } catch (err) {
    console.error('Security migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrateSecurity();
