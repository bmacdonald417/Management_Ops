/**
 * Centralized workflow logic: approve-to-bid blockers, risk log generation.
 */
import { query } from '../db/connection.js';

const RISK_LOG_FRESHNESS_DAYS = 7;

export interface ApproveToBidResult {
  ok: boolean;
  blockers: string[];
}

export async function getApproveToBidBlockers(solicitationId: string): Promise<ApproveToBidResult> {
  const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [solicitationId])).rows[0] as Record<string, unknown> | undefined;
  if (!sol) return { ok: false, blockers: ['Solicitation not found'] };

  const blockers: string[] = [];
  const clauses = (await query(
    `SELECT sc.id, rc.clause_number, cra.status as assessment_status, cra.risk_level
     FROM solicitation_clauses sc
     JOIN regulatory_clauses rc ON sc.clause_id = rc.id
     LEFT JOIN LATERAL (
       SELECT status, risk_level FROM clause_risk_assessments
       WHERE solicitation_clause_id = sc.id ORDER BY version DESC LIMIT 1
     ) cra ON true
     WHERE sc.solicitation_id = $1`,
    [solicitationId]
  )).rows as { clause_number: string; assessment_status: string; risk_level: string }[];

  if (clauses.length === 0) blockers.push('Clause extraction not complete; add at least one clause');
  const withoutApproved = clauses.filter((c) => c.assessment_status !== 'APPROVED');
  if (withoutApproved.length > 0) {
    blockers.push(`${withoutApproved.length} clause(s) need approved risk assessment`);
  }

  const l3l4 = clauses.filter((c) => ['L3', 'L4'].includes(c.risk_level));
  if (l3l4.length > 0) {
    const approvs = (await query(`SELECT approval_type, status FROM approvals WHERE solicitation_id = $1`, [solicitationId])).rows as { approval_type: string; status: string }[];
    const needQuality = !approvs.some((a) => a.approval_type === 'Quality' && a.status === 'Approved');
    if (needQuality) blockers.push('L3/L4 clauses require Quality approval');
    const l4Count = l3l4.filter((c) => c.risk_level === 'L4').length;
    if (l4Count > 0 && !approvs.some((a) => a.approval_type === 'Executive' && a.status === 'Approved')) {
      blockers.push('L4 clauses require Executive approval');
    }
  }

  const latestLog = (await query(
    `SELECT generated_at FROM clause_risk_log_snapshots WHERE solicitation_id = $1 ORDER BY generated_at DESC LIMIT 1`,
    [solicitationId]
  )).rows[0] as { generated_at: string } | undefined;
  if (!latestLog || new Date(latestLog.generated_at) < new Date(Date.now() - RISK_LOG_FRESHNESS_DAYS * 24 * 60 * 60 * 1000)) {
    blockers.push(`Clause Risk Log must be generated within last ${RISK_LOG_FRESHNESS_DAYS} days`);
  }

  return {
    ok: blockers.length === 0,
    blockers
  };
}

export interface RiskLogSnapshot {
  id: string;
  solicitation_id: string;
  generated_at: string;
  generated_by_user_id: string | null;
  overall_risk_level: string;
  overall_risk_score_percent: number;
  open_findings_count: number;
  high_risk_clause_count: number;
  json_payload: unknown;
}

export async function generateRiskLogSnapshot(
  solicitationId: string,
  generatedByUserId: string | null
): Promise<RiskLogSnapshot> {
  const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [solicitationId])).rows[0];
  if (!sol) throw new Error('Solicitation not found');

  const clauses = await query(
    `SELECT sc.id, rc.clause_number, rc.title, rc.regulation_type, cra.risk_level, cra.risk_score_percent, cra.risk_category
     FROM solicitation_clauses sc
     JOIN regulatory_clauses rc ON sc.clause_id = rc.id
     LEFT JOIN LATERAL (
       SELECT risk_level, risk_score_percent, risk_category FROM clause_risk_assessments
       WHERE solicitation_clause_id = sc.id ORDER BY version DESC LIMIT 1
     ) cra ON true
     WHERE sc.solicitation_id = $1`,
    [solicitationId]
  );

  const rows = clauses.rows as { risk_level: string; risk_score_percent: number }[];
  const l4Count = rows.filter((r) => r.risk_level === 'L4').length;
  const l3Count = rows.filter((r) => r.risk_level === 'L3').length;
  const maxScore = rows.reduce((m, r) => Math.max(m, r.risk_score_percent ?? 0), 0);
  const avgScore = rows.length > 0 ? rows.reduce((s, r) => s + (r.risk_score_percent ?? 0), 0) / rows.length : 0;
  const overallScore = Math.round(avgScore * 0.4 + maxScore * 0.6);
  let overallLevel = 'L1';
  if (overallScore >= 75) overallLevel = 'L4';
  else if (overallScore >= 50) overallLevel = 'L3';
  else if (overallScore >= 25) overallLevel = 'L2';

  const payload = { clauses: clauses.rows, generatedAt: new Date().toISOString() };

  const r = await query(
    `INSERT INTO clause_risk_log_snapshots (
      solicitation_id, generated_by_user_id, overall_risk_level, overall_risk_score_percent,
      open_findings_count, high_risk_clause_count, json_payload
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [solicitationId, generatedByUserId, overallLevel, overallScore, 0, l3Count + l4Count, JSON.stringify(payload)]
  );
  return r.rows[0] as RiskLogSnapshot;
}
