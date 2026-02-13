import { query } from '../connection.js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = path.resolve(__dirname, '../../../../Sources');

function parseFlowDown(value: string): boolean {
  if (!value) return true;
  const v = String(value).toLowerCase();
  return v === 'yes' || v === 'true' || v === '1';
}

function parseRiskLevel(value: string): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1 || n > 4) return 2;
  return n;
}

export async function seedFARDFARSClauses() {
  const farPath = path.join(SOURCES_PATH, 'far_clauses_sample.csv');
  const dfarsPath = path.join(SOURCES_PATH, 'dfars_clauses_sample.csv');

  for (const [label, filePath] of [
    ['FAR', farPath],
    ['DFARS', dfarsPath]
  ] as const) {
    let data: string;
    try {
      data = readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.warn(`⚠ ${label} file not found at ${filePath}, skipping`);
      return;
    }

    const rows = parse(data, { columns: true, skip_empty_lines: true });
    let count = 0;

    for (const row of rows) {
      const clauseNumber = String(row.clause_number ?? '').trim();
      const regulation = String(row.regulation ?? label).trim().toUpperCase();
      if (!clauseNumber) continue;

      await query(
        `INSERT INTO compliance_clauses 
          (clause_number, title, regulation, full_text_url, risk_category, risk_level, description, flow_down_required, applicability_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (clause_number, regulation) DO UPDATE SET
           title = EXCLUDED.title,
           risk_category = EXCLUDED.risk_category,
           risk_level = EXCLUDED.risk_level,
           description = EXCLUDED.description,
           flow_down_required = EXCLUDED.flow_down_required,
           applicability_notes = EXCLUDED.applicability_notes,
           updated_at = NOW()`,
        [
          clauseNumber,
          String(row.title ?? '').trim() || clauseNumber,
          regulation === 'FAR' || regulation === 'DFARS' ? regulation : label,
          row.full_text_url?.trim() || null,
          row.risk_category?.trim() || null,
          parseRiskLevel(row.risk_level ?? '2'),
          row.description?.trim() || null,
          parseFlowDown(row.flow_down_required ?? 'Yes'),
          row.applicability_notes?.trim() || null
        ]
      );
      count++;
    }
    console.log(`✅ Imported ${count} ${label} clauses`);
  }
}
