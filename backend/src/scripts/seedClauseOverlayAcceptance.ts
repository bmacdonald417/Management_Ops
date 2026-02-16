/**
 * Run acceptance seed: overlay for DFARS 252.204-7012
 * Usage: npx tsx src/scripts/seedClauseOverlayAcceptance.ts
 */
import { seedClauseOverlayAcceptance } from '../db/seeds/06_clause_overlay_acceptance.js';
import { pool } from '../db/connection.js';

async function main() {
  const ok = await seedClauseOverlayAcceptance();
  console.log(ok ? '✅ Overlay acceptance seed applied (252.204-7012)' : '⚠️ Skipped (run reg:ingest first)');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
