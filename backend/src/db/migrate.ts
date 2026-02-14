import { pool } from './connection.js';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const client = await pool.connect();
  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    await client.query(schema);
    console.log('✅ Schema applied');

    const migrationsDir = join(__dirname, 'migrations');
    try {
      const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const f of files) {
        const sql = readFileSync(join(migrationsDir, f), 'utf-8');
        await client.query(sql);
        console.log('✅ Migration:', f);
      }
    } catch {
      // migrations folder may not exist
    }
    console.log('✅ Database migration completed');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
