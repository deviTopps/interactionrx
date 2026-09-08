import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error(
      'Missing DATABASE_URL in backend/.env\n\n' +
        'Get it from Supabase Dashboard → Project Settings → Database → Connection string (URI)\n' +
        'Then add: DATABASE_URL=postgresql://postgres.[ref]:[password]@...'
    );
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, '../../supabase/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database. Running schema...');
    await client.query(sql);
    console.log('✓ Database tables created successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
