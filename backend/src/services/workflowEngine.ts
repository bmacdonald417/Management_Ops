/**
 * Centralized workflow logic: approve-to-bid blockers, risk log generation.
 * Governance Engine v1: strict gates, structured blockers.
 */
import { query } from '../db/connection.js';

const RISK_LOG_FRESHNESS_DAYS = 7;

export interface BlockerItem {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  remediation: string;
  /** When set, frontend can deep-link to resolve (e.g. first clause that needs assessment). */
  actionSolicitationClauseId?: string;
}

export interface ApproveToBidResult {
  canApprove: boolean;
  blockers: BlockerItem[];
}

function blocker(
  code: string,
  message: string,
  remediation: string,
  severity: BlockerItem['severity'] = 'error',
  actionSolicitationClauseId?: string
): BlockerItem {
  return { code, severity, message, remediation, actionSolicitationClauseId };
}

export async function getApproveToBidBlockers(solicitationId: string): Promise<ApproveToBidResult> {
  const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [solicitationId])).rows[0] as Record<string, unknown> | undefined;
  if (!sol) {
    return { canApprove: false, blockers: [blocker('NOT_FOUND', 'Solicitation not found', 'Check solicitation ID')] };
  }

  const blockers: BlockerItem[] = [];
  const clauses = (await query(
    `SELECT sc.id AS solicitation_clause_id,
       COALESCE(u.is_flow_down, sc.is_flow_down_required) AS is_flow_down_required,
       COALESCE(u.clause_number, rc.clause_number) AS clause_number,
       cra.status AS assessment_status, cra.risk_level, cra.flowdown_review_completed
     FROM solicitation_clauses sc
     LEFT JOIN unified_clause_master u ON sc.unified_clause_master_id = u.id
     LEFT JOIN regulatory_clauses rc ON sc.clause_id = rc.id
     LEFT JOIN LATERAL (
       SELECT status, risk_level, flowdown_review_completed FROM clause_risk_assessments
       WHERE solicitation_clause_id = sc.id ORDER BY version DESC LIMIT 1
     ) cra ON true
     WHERE sc.solicitation_id = $1 AND (u.id IS NOT NULL OR rc.id IS NOT NULL)`,
    [solicitationId]
  )).rows as { solicitation_clause_id: string; is_flow_down_required: boolean; clause_number: string; assessment_status: string; risk_level: string; flowdown_review_completed: boolean }[];

  if (clauses.length === 0) {
    blockers.push(blocker(
      'NO_CLAUSES',
      'Clause extraction not complete; add at least one clause',
      'Use Clause Extraction tab to extract from pasted text or add from Clause Library'
    ));
  }

  const withoutApproved = clauses.filter((c) => c.assessment_status !== 'APPROVED');
  if (withoutApproved.length > 0) {
    const firstId = withoutApproved[0]?.solicitation_clause_id;
    blockers.push(blocker(
      'UNASSESSED_CLAUSES',
      `${withoutApproved.length} clause(s) need approved risk assessment`,
      'Assess each clause in Clause Review tab and submit for approval where required',
      'error',
      firstId
    ));
  }

  const flowdownRequired = clauses.filter((c) => c.is_flow_down_required);
  const flowdownIncomplete = flowdownRequired.filter((c) => c.assessment_status === 'APPROVED' && !c.flowdown_review_completed);
  if (flowdownIncomplete.length > 0) {
    const firstId = flowdownIncomplete[0]?.solicitation_clause_id;
    blockers.push(blocker(
      'FLOWDOWN_REVIEW_PENDING',
      `${flowdownIncomplete.length} flow-down-required clause(s) need Flowdown Review completed`,
      'Complete Flowdown Review on each flow-down-required clause in the assessment',
      'error',
      firstId
    ));
  }

  const l3l4 = clauses.filter((c) => ['L3', 'L4'].includes(c.risk_level));
  if (l3l4.length > 0) {
    const approvs = (await query(`SELECT approval_type, status FROM approvals WHERE solicitation_id = $1`, [solicitationId])).rows as { approval_type: string; status: string }[];
    const needQuality = !approvs.some((a) => a.approval_type === 'Quality' && a.status === 'Approved');
    if (needQuality) {
      blockers.push(blocker(
        'QUALITY_APPROVAL_REQUIRED',
        'L3/L4 clauses require Quality approval',
        'Obtain Quality approval from Approvals tab'
      ));
    }
    const l4Count = l3l4.filter((c) => c.risk_level === 'L4').length;
    if (l4Count > 0 && !approvs.some((a) => a.approval_type === 'Executive' && a.status === 'Approved')) {
      blockers.push(blocker(
        'EXECUTIVE_APPROVAL_REQUIRED',
        'L4 clauses require Executive approval',
        'Obtain Executive approval from Approvals tab'
      ));
    }
  }

  const latestLog = (await query(
    `SELECT generated_at FROM clause_risk_log_snapshots WHERE solicitation_id = $1 ORDER BY generated_at DESC LIMIT 1`,
    [solicitationId]
  )).rows[0] as { generated_at: string } | undefined;
  if (!latestLog || new Date(latestLog.generated_at) < new Date(Date.now() - RISK_LOG_FRESHNESS_DAYS * 24 * 60 * 60 * 1000)) {
    blockers.push(blocker(
      'RISK_LOG_STALE',
      `Clause Risk Log must be generated within last ${RISK_LOG_FRESHNESS_DAYS} days`,
      'Generate Risk Log from Clause Risk Log tab after all blockers are cleared'
    ));
  }

  return {
    canApprove: blockers.length === 0,
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

interface ClauseRow {
  clause_number: string;
  title: string;
  regulation_type: string;
  risk_level: string;
  risk_score_percent: number;
  risk_category: string;
  is_flow_down_required?: boolean;
}

export async function generateRiskLogSnapshot(
  solicitationId: string,
  generatedByUserId: string | null
): Promise<RiskLogSnapshot> {
  const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [solicitationId])).rows[0];
  if (!sol) throw new Error('Solicitation not found');

  const clauses = await query(
    `SELECT COALESCE(u.clause_number, rc.clause_number) AS clause_number,
       COALESCE(u.title, rc.title) AS title,
       COALESCE(u.regulation, rc.regulation_type) AS regulation_type,
       COALESCE(u.is_flow_down, sc.is_flow_down_required) AS is_flow_down_required,
       cra.risk_level, cra.risk_score_percent, cra.risk_category
     FROM solicitation_clauses sc
     LEFT JOIN unified_clause_master u ON sc.unified_clause_master_id = u.id
     LEFT JOIN regulatory_clauses rc ON sc.clause_id = rc.id
     LEFT JOIN LATERAL (
       SELECT risk_level, risk_score_percent, risk_category FROM clause_risk_assessments
       WHERE solicitation_clause_id = sc.id ORDER BY version DESC LIMIT 1
     ) cra ON true
     WHERE sc.solicitation_id = $1 AND (u.id IS NOT NULL OR rc.id IS NOT NULL)
     ORDER BY COALESCE(cra.risk_score_percent, 0) DESC, COALESCE(u.clause_number, rc.clause_number)`,
    [solicitationId]
  );

  const rows = clauses.rows as ClauseRow[];
  const l1 = rows.filter((r) => r.risk_level === 'L1' || !r.risk_level).length;
  const l2 = rows.filter((r) => r.risk_level === 'L2').length;
  const l3 = rows.filter((r) => r.risk_level === 'L3').length;
  const l4 = rows.filter((r) => r.risk_level === 'L4').length;
  const maxScore = rows.reduce((m, r) => Math.max(m, r.risk_score_percent ?? 0), 0);
  const avgScore = rows.length > 0 ? rows.reduce((s, r) => s + (r.risk_score_percent ?? 0), 0) / rows.length : 0;
  const overallScore = Math.round(avgScore * 0.4 + maxScore * 0.6);
  let overallLevel = 'L1';
  if (overallScore >= 75) overallLevel = 'L4';
  else if (overallScore >= 50) overallLevel = 'L3';
  else if (overallScore >= 25) overallLevel = 'L2';

  const top10 = rows.slice(0, 10).map((r) => ({
    clause_number: r.clause_number,
    title: r.title,
    risk_level: r.risk_level ?? 'L1',
    risk_score_percent: r.risk_score_percent ?? 0
  }));
  const flowdownList = rows.filter((r) => r.is_flow_down_required).map((r) => r.clause_number);

  const payload = {
    clauses: clauses.rows,
    l1Count: l1,
    l2Count: l2,
    l3Count: l3,
    l4Count: l4,
    top10ClausesByRisk: top10,
    flowdownClauses: flowdownList,
    generatedAt: new Date().toISOString()
  };

  const r = await query(
    `INSERT INTO clause_risk_log_snapshots (
      solicitation_id, generated_by_user_id, overall_risk_level, overall_risk_score_percent,
      open_findings_count, high_risk_clause_count, json_payload
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [solicitationId, generatedByUserId, overallLevel, overallScore, 0, l3 + l4, JSON.stringify(payload)]
  );
  return r.rows[0] as RiskLogSnapshot;
}
