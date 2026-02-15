import { pool } from './connection.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// When run from dist/db/, SQL files are in src/db/ (sibling of dist)
const dbDir = existsSync(join(__dirname, 'schema.sql'))
  ? __dirname
  : join(__dirname, '..', '..', 'src', 'db');

const SAFE_MODE = process.env.SAFE_MODE === 'true' || process.env.SAFE_MODE === '1';

async function migrate() {
  if (SAFE_MODE) {
    console.log('[Migrate] ⚠️ SAFE_MODE enabled - skipping migrations');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    const schemaPath = join(dbDir, 'schema.sql');
    if (existsSync(schemaPath)) {
      console.log('[Migrate] Running schema...');
      const schema = readFileSync(schemaPath, 'utf-8');
      await client.query(schema);
      console.log('[Migrate] Schema applied ✓');
    }

    const migrationsDir = join(dbDir, 'migrations');
    if (existsSync(migrationsDir)) {
      const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const f of files) {
        console.log('[Migrate] Running:', f);
        const sql = readFileSync(join(migrationsDir, f), 'utf-8');
        try {
          await client.query(sql);
          console.log('[Migrate]', f, '✓');
        } catch (err: unknown) {
          const e = err as Error & { code?: string; detail?: string };
          console.error('[Migrate] Failed:', f);
          console.error('   Error:', e.message);
          console.error('   Code:', e.code);
          console.error('   Detail:', e.detail);
          if (e.stack) console.error('   Stack:', e.stack);
          throw err;
        }
      }
    }
    console.log('[Migrate] Database migration completed ✓');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
