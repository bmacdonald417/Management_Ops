/**
 * Phase 1: Migrate clause data from regulatory_clauses, clause_library_items,
 * compliance_clauses, and clause_master into unified_clause_master.
 * Prioritizes regulatory_clauses where overlaps exist. Idempotent.
 */
import { query } from '../db/connection.js';

function normalizeClauseNumber(input: string): string {
  return input.replace(/^(FAR|DFARS)\s*/i, '').replace(/\s+/g, ' ').trim();
}

type Regulation = 'FAR' | 'DFARS';

interface UnifiedRow {
  id: string;
  regulation: Regulation;
  clause_number: string;
}

async function ensureUnifiedClause(row: {
  clause_number: string;
  title: string;
  full_text: string | null;
  regulation: Regulation;
  part?: string | null;
  subpart?: string | null;
  hierarchy_level?: number | null;
  risk_category?: string | null;
  risk_score?: number | null;
  is_flow_down: boolean;
  source: string;
  override_risk_category?: string | null;
  override_risk_score?: number | null;
  override_flow_down_required?: boolean | null;
  override_suggested_mitigation?: string | null;
  overlay_tags?: unknown;
  overlay_notes?: string | null;
  flow_down_notes?: string | null;
  updated_by_id?: string | null;
}): Promise<UnifiedRow | null> {
  const num = normalizeClauseNumber(row.clause_number);
  const title = (row.title || '').slice(0, 500);
  const fullText = (row.full_text ?? '').slice(0, 100000);
  const part = (row.part ?? '').slice(0, 20);
  const subpart = (row.subpart ?? '').slice(0, 50);
  const source = row.source.slice(0, 50);

  const r = await query(
    `INSERT INTO unified_clause_master (
      clause_number, title, full_text, regulation, part, subpart, hierarchy_level,
      is_flow_down, source, risk_category, risk_score,
      override_risk_category, override_risk_score, override_flow_down_required,
      override_suggested_mitigation, overlay_tags, overlay_notes, flow_down_notes, updated_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (regulation, clause_number) DO UPDATE SET
      title = EXCLUDED.title,
      full_text = COALESCE(NULLIF(EXCLUDED.full_text, ''), unified_clause_master.full_text),
      part = COALESCE(NULLIF(EXCLUDED.part, ''), unified_clause_master.part),
      subpart = COALESCE(EXCLUDED.subpart, unified_clause_master.subpart),
      hierarchy_level = COALESCE(EXCLUDED.hierarchy_level, unified_clause_master.hierarchy_level),
      risk_category = COALESCE(EXCLUDED.risk_category, unified_clause_master.risk_category),
      risk_score = COALESCE(EXCLUDED.risk_score, unified_clause_master.risk_score),
      is_flow_down = COALESCE(EXCLUDED.is_flow_down, unified_clause_master.is_flow_down),
      override_risk_category = COALESCE(EXCLUDED.override_risk_category, unified_clause_master.override_risk_category),
      override_risk_score = COALESCE(EXCLUDED.override_risk_score, unified_clause_master.override_risk_score),
      override_flow_down_required = COALESCE(EXCLUDED.override_flow_down_required, unified_clause_master.override_flow_down_required),
      override_suggested_mitigation = COALESCE(EXCLUDED.override_suggested_mitigation, unified_clause_master.override_suggested_mitigation),
      overlay_tags = COALESCE(EXCLUDED.overlay_tags, unified_clause_master.overlay_tags),
      overlay_notes = COALESCE(EXCLUDED.overlay_notes, unified_clause_master.overlay_notes),
      flow_down_notes = COALESCE(EXCLUDED.flow_down_notes, unified_clause_master.flow_down_notes),
      updated_by_id = COALESCE(EXCLUDED.updated_by_id, unified_clause_master.updated_by_id),
      updated_at = NOW()
    RETURNING id, regulation, clause_number`,
    [
      num, title, fullText || '', row.regulation, part || '52', subpart, row.hierarchy_level ?? null,
      row.is_flow_down, source,
      row.risk_category ?? null, row.risk_score ?? null,
      row.override_risk_category ?? null, row.override_risk_score ?? null, row.override_flow_down_required ?? null,
      row.override_suggested_mitigation ?? null,
      row.overlay_tags != null ? JSON.stringify(row.overlay_tags) : '[]',
      row.overlay_notes ?? null, row.flow_down_notes ?? null, row.updated_by_id ?? null
    ]
  );
  const out = r.rows[0] as UnifiedRow | undefined;
  return out ?? null;
}

async function ensureInitialVersion(unifiedId: string): Promise<void> {
  await query(
    `INSERT INTO unified_clause_versions (unified_clause_master_id, version, summary_of_changes, effective_date)
     VALUES ($1, 1, 'Initial migration', NOW())
     ON CONFLICT (unified_clause_master_id, version) DO NOTHING`,
    [unifiedId]
  );
}

async function main(): Promise<void> {
  console.log('[migrateClauseData] Starting...');

  // 1. regulatory_clauses (priority)
  const regRows = (await query(
    `SELECT id, regulation_type, clause_number, title, full_text, part, subpart, hierarchy_level,
            risk_category, risk_score, flow_down_required FROM regulatory_clauses`
  )).rows as { regulation_type: string; clause_number: string; title: string; full_text: string; part?: string; subpart?: string; hierarchy_level?: number; risk_category?: string; risk_score?: number; flow_down_required: boolean }[];

  let count = 0;
  for (const row of regRows) {
    const reg = row.regulation_type === 'DFARS' ? 'DFARS' : 'FAR';
    const u = await ensureUnifiedClause({
      clause_number: row.clause_number,
      title: row.title,
      full_text: row.full_text,
      regulation: reg,
      part: row.part ?? '52',
      subpart: row.subpart,
      hierarchy_level: row.hierarchy_level,
      risk_category: row.risk_category ?? null,
      risk_score: row.risk_score ?? null,
      is_flow_down: Boolean(row.flow_down_required),
      source: 'ingestRegulations'
    });
    if (u) await ensureInitialVersion(u.id);
    count++;
  }
  console.log('[migrateClauseData] regulatory_clauses:', count);

  // 2. clause_library_items: update overlay or insert if no regulatory match
  const libRows = (await query(
    `SELECT clause_number, title, regulation_type, override_risk_category, override_risk_score,
            override_flow_down_required, override_suggested_mitigation, tags, notes, flow_down_notes, updated_by
     FROM clause_library_items`
  )).rows as { clause_number: string; title: string; regulation_type?: string; override_risk_category?: string; override_risk_score?: number; override_flow_down_required?: boolean; override_suggested_mitigation?: string; tags?: unknown; notes?: string; flow_down_notes?: string; updated_by?: string }[];

  for (const row of libRows) {
    const num = normalizeClauseNumber(row.clause_number);
    const reg: Regulation = (row.regulation_type === 'DFARS' ? 'DFARS' : 'FAR');
    const u = await ensureUnifiedClause({
      clause_number: num,
      title: row.title,
      full_text: '',
      regulation: reg,
      part: '52',
      is_flow_down: false,
      source: 'clause_library',
      override_risk_category: row.override_risk_category ?? null,
      override_risk_score: row.override_risk_score ?? null,
      override_flow_down_required: row.override_flow_down_required ?? null,
      override_suggested_mitigation: row.override_suggested_mitigation ?? null,
      overlay_tags: row.tags ?? [],
      overlay_notes: row.notes ?? null,
      flow_down_notes: row.flow_down_notes ?? null,
      updated_by_id: row.updated_by ?? null
    });
    if (u) await ensureInitialVersion(u.id);
  }
  console.log('[migrateClauseData] clause_library_items:', libRows.length);

  // 3. compliance_clauses: insert only if (regulation, clause_number) not present
  const compRows = (await query(
    `SELECT clause_number, title, regulation, full_text, risk_category, risk_level, flow_down_required
     FROM compliance_clauses`
  )).rows as { clause_number: string; title: string; regulation: string; full_text?: string; risk_category?: string; risk_level?: number; flow_down_required?: boolean }[];

  let compAdded = 0;
  for (const row of compRows) {
    const num = normalizeClauseNumber(row.clause_number);
    const reg: Regulation = (row.regulation === 'DFARS' ? 'DFARS' : 'FAR');
    const exists = (await query(
      `SELECT 1 FROM unified_clause_master WHERE regulation = $1 AND clause_number = $2`,
      [reg, num]
    )).rows.length > 0;
    if (exists) continue;
    const u = await ensureUnifiedClause({
      clause_number: num,
      title: row.title,
      full_text: row.full_text ?? '',
      regulation: reg,
      part: '52',
      is_flow_down: Boolean(row.flow_down_required),
      source: 'compliance_clauses',
      risk_category: row.risk_category ?? null,
      risk_score: row.risk_level ?? null
    });
    if (u) await ensureInitialVersion(u.id);
    compAdded++;
  }
  console.log('[migrateClauseData] compliance_clauses: added', compAdded, '(skipped existing)');

  // 4. clause_master (registry): insert only if not present
  const masterRows = (await query(
    `SELECT clause_number, title, regulation, full_text, category, risk_level, flow_down
     FROM clause_master`
  )).rows as { clause_number: string; title: string; regulation: string; full_text?: string; category?: string; risk_level?: number; flow_down?: string }[];

  let masterAdded = 0;
  for (const row of masterRows) {
    const num = normalizeClauseNumber(row.clause_number);
    const reg: Regulation = (row.regulation === 'DFARS' ? 'DFARS' : 'FAR');
    const exists = (await query(
      `SELECT 1 FROM unified_clause_master WHERE regulation = $1 AND clause_number = $2`,
      [reg, num]
    )).rows.length > 0;
    if (exists) continue;
    const u = await ensureUnifiedClause({
      clause_number: num,
      title: row.title,
      full_text: row.full_text ?? '',
      regulation: reg,
      part: '52',
      is_flow_down: (row.flow_down ?? '').toUpperCase() === 'YES',
      source: 'registry_import',
      risk_category: row.category ?? null,
      risk_score: row.risk_level ?? null
    });
    if (u) await ensureInitialVersion(u.id);
    masterAdded++;
  }
  console.log('[migrateClauseData] clause_master: added', masterAdded, '(skipped existing)');

  const total = (await query(`SELECT COUNT(*) AS c FROM unified_clause_master`)).rows[0] as { c: string };
  console.log('[migrateClauseData] Total unified_clause_master rows:', total.c);

  // 5. Backfill solicitation_clauses.unified_clause_master_id (if column exists)
  const hasCol = (await query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'solicitation_clauses' AND column_name = 'unified_clause_master_id'`
  )).rows.length > 0;
  if (hasCol) {
    const up = await query(`
      UPDATE solicitation_clauses sc
      SET unified_clause_master_id = u.id
      FROM regulatory_clauses rc
      JOIN unified_clause_master u ON u.regulation = rc.regulation_type AND u.clause_number = rc.clause_number
      WHERE sc.clause_id = rc.id AND sc.unified_clause_master_id IS NULL
    `);
    console.log('[migrateClauseData] Backfilled solicitation_clauses.unified_clause_master_id:', up.rowCount);
  }

  console.log('[migrateClauseData] Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
