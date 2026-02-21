/**
 * CLI script to ingest a Trust Codex evidence bundle (ZIP) into cmmc_control_evidence.
 * Usage: npx tsx src/scripts/ingestCmmcEvidence.ts [path-to-bundle.zip]
 * Requires DATABASE_URL. Uses first Level 1/Level 3 user as ingested_by.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { query, pool } from '../db/connection.js';
import { processEvidenceBundle } from '../services/evidenceIngestor.js';

const BUNDLE_PATH =
  process.argv[2] ??
  resolve(process.cwd(), '..', 'docs', 'CMMC_Ingest', 'codex-qms-export-2026-02-21T03-15-31.zip');

async function main() {
  console.log('[Ingest] Reading bundle:', BUNDLE_PATH);
  const buffer = readFileSync(BUNDLE_PATH);

  const userRes = await query(
    `SELECT id FROM users WHERE role IN ('Level 1', 'Level 3') ORDER BY created_at LIMIT 1`
  );
  const userId = (userRes.rows[0] as { id: string } | undefined)?.id;
  if (!userId) {
    console.error('[Ingest] No Level 1 or Level 3 user found. Run db:seed first or add an admin user.');
    process.exit(1);
  }

  console.log('[Ingest] Processing bundle...');
  const { ingestId } = await processEvidenceBundle(buffer, userId);
  console.log('[Ingest] Success. Ingest ID:', ingestId);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[Ingest] Failed:', err.message);
    process.exit(1);
  });
