#!/usr/bin/env node
/**
 * One-time migration: copy legacy solicitation_versions + clause_review_entries
 * into engine tables (solicitation_clauses, clause_risk_assessments).
 * Resolves clause_number to regulatory_clauses; maps legacy risk_level/total_score
 * to engine L1–L4 and risk_score_percent. Idempotent: skips solicitations that
 * already have solicitation_clauses.
 *
 * Run: npx tsx src/scripts/migrateLegacySolicitationsToEngine.ts
 * Or:  node dist/scripts/migrateLegacySolicitationsToEngine.js (after tsc)
 */
import { query, pool } from '../db/connection.js';

function normalizeClauseNumber(cn: string): string {
  return cn.replace(/^(FAR|DFARS)\s*/i, '').replace(/\s+/g, '').trim();
}

/** Infer regulation from clause number: 252.xxx -> DFARS, else FAR */
function inferRegulation(clauseNumber: string): 'FAR' | 'DFARS' {
  const n = normalizeClauseNumber(clauseNumber);
  return n.startsWith('252.') ? 'DFARS' : 'FAR';
}

/** Map legacy risk_level 1–4 to engine L1–L4 */
function toEngineRiskLevel(legacyLevel: number | null): 'L1' | 'L2' | 'L3' | 'L4' {
  if (legacyLevel == null || legacyLevel < 1) return 'L1';
  if (legacyLevel === 1) return 'L1';
  if (legacyLevel === 2) return 'L2';
  if (legacyLevel === 3) return 'L3';
  return 'L4';
}

/** Map legacy total_score / risk_level to 0–100 percent for engine */
function toEngineRiskScorePercent(totalScore: number | null, riskLevel: number | null): number {
  if (riskLevel != null && riskLevel >= 1 && riskLevel <= 4) {
    return Math.min(100, riskLevel * 25); // L1=25, L2=50, L3=75, L4=100
  }
  if (totalScore != null && !Number.isNaN(Number(totalScore))) {
    return Math.min(100, Math.max(0, Math.round((Number(totalScore) / 25) * 100)));
  }
  return 25;
}

async function main(): Promise<void> {
  console.log('[migrateLegacySolicitationsToEngine] Starting...');

  const solicitationsWithLegacy = (await query(
    `SELECT s.id, s.status, s.current_version
     FROM solicitations s
     INNER JOIN solicitation_versions sv ON sv.solicitation_id = s.id AND sv.version = s.current_version
     INNER JOIN clause_review_entries ce ON ce.version_id = sv.id
     GROUP BY s.id, s.status, s.current_version`
  )).rows as { id: string; status: string; current_version: number }[];

  const alreadyMigrated = new Set(
    (await query(`SELECT DISTINCT solicitation_id FROM solicitation_clauses`)).rows.map(
      (r: { solicitation_id: string }) => r.solicitation_id
    )
  );

  let migrated = 0;
  let skipped = 0;
  const unresolved: { solicitation_id: string; clause_number: string }[] = [];

  for (const sol of solicitationsWithLegacy) {
    if (alreadyMigrated.has(sol.id)) {
      skipped++;
      continue;
    }

    const versionRow = (await query(
      `SELECT id FROM solicitation_versions WHERE solicitation_id = $1 AND version = $2`,
      [sol.id, sol.current_version]
    )).rows[0] as { id: string } | undefined;
    if (!versionRow) continue;

    const entries = (await query(
      `SELECT id, clause_number, clause_title, category, total_score, risk_level, escalation_trigger
       FROM clause_review_entries WHERE version_id = $1 ORDER BY created_at`,
      [versionRow.id]
    )).rows as { id: string; clause_number: string; clause_title: string | null; category: string | null; total_score: number | null; risk_level: number | null; escalation_trigger: boolean }[];

    let insertedClauses = 0;
    for (const entry of entries) {
      const num = normalizeClauseNumber(entry.clause_number);
      const regulation = inferRegulation(entry.clause_number);

      const rc = (await query(
        `SELECT id, flow_down_required FROM regulatory_clauses WHERE regulation_type = $1 AND clause_number = $2`,
        [regulation, num]
      )).rows[0] as { id: string; flow_down_required: boolean } | undefined;

      if (!rc) {
        unresolved.push({ solicitation_id: sol.id, clause_number: entry.clause_number });
        continue;
      }

      let unifiedId: string | null = null;
      try {
        const u = (await query(
          `SELECT id FROM unified_clause_master WHERE regulation = $1 AND clause_number = $2`,
          [regulation, num]
        )).rows[0] as { id: string } | undefined;
        unifiedId = u?.id ?? null;
      } catch {
        // unified_clause_master may not exist
      }

      try {
        const ins = await query(
          `INSERT INTO solicitation_clauses (
            solicitation_id, clause_id, unified_clause_master_id, detected_from, detected_confidence, is_flow_down_required
          ) VALUES ($1, $2, $3, 'API_IMPORT', 0.9, $4)
          ON CONFLICT (solicitation_id, clause_id) DO NOTHING
          RETURNING id`,
          [sol.id, rc.id, unifiedId, rc.flow_down_required ?? true]
        );
        const scRow = ins.rows[0] as { id: string } | undefined;
        if (!scRow) continue;
        insertedClauses++;

        const riskLevel = toEngineRiskLevel(entry.risk_level);
        const riskScorePercent = toEngineRiskScorePercent(entry.total_score, entry.risk_level);
        const riskCategory = (entry.category || 'General').slice(0, 50);
        const status = ['FINALIZED', 'APPROVED', 'AWAITING_APPROVALS'].includes(sol.status) ? 'APPROVED' : 'DRAFT';

        await query(
          `INSERT INTO clause_risk_assessments (
            solicitation_clause_id, risk_level, risk_score_percent, risk_category, rationale, status,
            assessed_risk_score, effective_final_risk_score, base_risk_score, flowdown_review_completed
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            scRow.id,
            riskLevel,
            riskScorePercent,
            riskCategory,
            `Migrated from legacy clause_review_entries (risk_level ${entry.risk_level ?? 'n/a'})`,
            status,
            riskScorePercent,
            riskScorePercent,
            riskScorePercent,
            true
          ]
        );
      } catch (err) {
        console.warn(`[migrateLegacySolicitationsToEngine] Skip clause ${entry.clause_number} for sol ${sol.id}:`, (err as Error).message);
      }
    }

    if (insertedClauses > 0) {
      const newStatus = ['FINALIZED', 'APPROVED'].includes(sol.status)
        ? 'APPROVED_TO_BID'
        : sol.status === 'AWAITING_APPROVALS'
          ? 'APPROVAL_REQUIRED'
          : 'REVIEW_COMPLETE';
      await query(
        `UPDATE solicitations SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newStatus, sol.id]
      );
      migrated++;
    }
  }

  console.log('[migrateLegacySolicitationsToEngine] Done. Migrated:', migrated, 'Skipped (already had engine data):', skipped);
  if (unresolved.length > 0) {
    console.log('[migrateLegacySolicitationsToEngine] Unresolved clause numbers (no regulatory_clauses match):', unresolved.length);
    const sample = unresolved.slice(0, 10);
    sample.forEach((u) => console.log('  -', u.solicitation_id, u.clause_number));
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
