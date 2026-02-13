import { query } from '../connection.js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = path.resolve(__dirname, '../../../../Sources');

export async function seedNISTControls() {
  const controlsPath = path.join(SOURCES_PATH, 'nist_800_171_controls.csv');

  let data: string;
  try {
    data = readFileSync(controlsPath, 'utf-8');
  } catch (err) {
    console.warn(`⚠ NIST controls file not found at ${controlsPath}, skipping`);
    return;
  }

  const rows = parse(data, { columns: true, skip_empty_lines: true });
  let count = 0;

  for (const row of rows) {
    const id = String(row.control_identifier ?? '').trim();
    if (!id) continue;

    await query(
      `INSERT INTO cmmc_controls 
        (control_identifier, domain, level, practice_statement, objective, discussion, evidence_examples)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (control_identifier) DO UPDATE SET
         domain = EXCLUDED.domain,
         level = EXCLUDED.level,
         practice_statement = EXCLUDED.practice_statement,
         objective = EXCLUDED.objective,
         discussion = EXCLUDED.discussion,
         evidence_examples = EXCLUDED.evidence_examples,
         updated_at = NOW()`,
      [
        id,
        String(row.domain ?? 'Other').trim(),
        String(row.level ?? 'Level 2').trim(),
        String(row.practice_statement ?? '').trim() || id,
        String(row.objective ?? '').trim() || null,
        row.discussion?.trim() || null,
        row.evidence_examples?.trim() || null
      ]
    );
    count++;
  }
  console.log(`✅ Imported ${count} CMMC/NIST 800-171 controls`);
}
