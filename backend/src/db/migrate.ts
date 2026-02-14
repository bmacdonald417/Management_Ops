import { pool } from './connection.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SAFE_MODE = process.env.SAFE_MODE === 'true' || process.env.SAFE_MODE === '1';

async function migrate() {
  if (SAFE_MODE) {
    console.log('⚠️ SAFE_MODE enabled - skipping migrations');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    const schemaPath = join(__dirname, 'schema.sql');
    if (existsSync(schemaPath)) {
      console.log('Running schema...');
      const schema = readFileSync(schemaPath, 'utf-8');
      await client.query(schema);
      console.log('✅ Schema applied');
    }

    const migrationsDir = join(__dirname, 'migrations');
    if (existsSync(migrationsDir)) {
      const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const f of files) {
        console.log('Running migration:', f);
        const sql = readFileSync(join(migrationsDir, f), 'utf-8');
        try {
          await client.query(sql);
          console.log('✅ Migration:', f);
        } catch (err: unknown) {
          const e = err as Error & { code?: string; detail?: string };
          console.error('❌ Migration failed:', f);
          console.error('   Error:', e.message);
          console.error('   Code:', e.code);
          console.error('   Detail:', e.detail);
          if (e.stack) console.error('   Stack:', e.stack);
          throw err;
        }
      }
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
