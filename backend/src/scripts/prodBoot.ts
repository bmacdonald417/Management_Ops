#!/usr/bin/env node
/**
 * Production boot entrypoint for Railway.
 * ALWAYS: migrate → (ingest if RUN_REG_INGEST=true) → API server.
 * Server is spawned and kept running; process does not exit until server exits.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

async function main() {
  console.log('PROD BOOT: starting');

  // 1. ALWAYS run migrations
  console.log('PROD BOOT: migration starting');
  try {
    const migrate = spawn('node', ['dist/db/migrate.js'], { cwd: root, stdio: 'inherit' });
    await new Promise<void>((resolve, reject) => {
      migrate.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`migrate exited with ${code ?? 1}`));
      });
      migrate.on('error', reject);
    });
  } catch (err) {
    console.error('PROD BOOT: migration failed', err);
    process.exit(1);
  }
  console.log('PROD BOOT: migration complete');

  // 2. Conditionally run ingestion
  if (process.env.RUN_REG_INGEST === 'true') {
    console.log('PROD BOOT: ingestion starting');
    try {
      const ingest = spawn('node', ['dist/scripts/ingestRegulations.js'], { cwd: root, stdio: 'inherit' });
      await new Promise<void>((resolve, reject) => {
        ingest.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ingest exited with ${code ?? 1}`));
        });
        ingest.on('error', reject);
      });
      console.log('PROD BOOT: ingestion complete');
    } catch (err) {
      console.error('PROD BOOT: ingestion failed', err);
      process.exit(1);
    }
  } else {
    console.log('PROD BOOT: ingestion skipped (RUN_REG_INGEST not true)');
  }

  // 3. Start API server - spawn and wait; keeps container alive
  console.log('PROD BOOT: starting API');
  const server = spawn('node', ['dist/index.js'], { cwd: root, stdio: 'inherit' });

  server.on('error', (err) => {
    console.error('PROD BOOT: API server error', err);
    process.exit(1);
  });

  server.on('exit', (code, signal) => {
    console.log('PROD BOOT: API server exited', { code, signal });
    process.exit(code ?? 1);
  });

  // Forward signals to server for graceful shutdown
  process.on('SIGTERM', () => server.kill('SIGTERM'));
  process.on('SIGINT', () => server.kill('SIGINT'));
}

main().catch((err) => {
  console.error('PROD BOOT: fatal', err);
  process.exit(1);
});
