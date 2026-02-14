import { query } from '../../db/connection.js';
import { computeGovernanceIndex, type MaturityResult } from '../governanceMaturity.js';

export interface ClauseLibraryStats {
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  byRiskLevel: Record<number, number>;
  flowDownCounts: Record<string, number>;
  activeCounts: number;
}

export interface SolicitationStats {
  totalSolicitations: number;
  withClauseReview: number;
  withApprovals: number;
  finalized: number;
  finalizedWithoutApprovals: number;
  escalations: { cyber: number; financial: number; indemn: number; audit: number };
}

export interface ClauseReviewStats {
  totalClausesReviewed: number;
  avgClauseRisk: number;
  l1: number;
  l2: number;
  l3: number;
  l4: number;
}

export interface ApprovalStats {
  requiredApprovalsMetRate: number;
  byType: Record<string, { approved: number; pending: number; rejected: number }>;
}

export interface AuditStats {
  solicitationsWithAuditEventsRate: number;
  avgAuditEventsPerSolicitation: number;
}

export interface AutoBuilderContext {
  activeRiskConfig: Record<string, unknown>;
  clauseLibraryStats: ClauseLibraryStats;
  solicitationStats: SolicitationStats;
  clauseReviewStats: ClauseReviewStats;
  approvalStats: ApprovalStats;
  auditStats: AuditStats;
  maturity: MaturityResult;
}

const ZERO_CLS: ClauseLibraryStats = { total: 0, byType: {}, byCategory: {}, byRiskLevel: {}, flowDownCounts: {}, activeCounts: 0 };
const ZERO_SOL: SolicitationStats = { totalSolicitations: 0, withClauseReview: 0, withApprovals: 0, finalized: 0, finalizedWithoutApprovals: 0, escalations: { cyber: 0, financial: 0, indemn: 0, audit: 0 } };
const ZERO_CR: ClauseReviewStats = { totalClausesReviewed: 0, avgClauseRisk: 0, l1: 0, l2: 0, l3: 0, l4: 0 };
const ZERO_AP: ApprovalStats = { requiredApprovalsMetRate: 0, byType: {} };
const ZERO_AU: AuditStats = { solicitationsWithAuditEventsRate: 0, avgAuditEventsPerSolicitation: 0 };

export async function loadAutoBuilderContext(): Promise<AutoBuilderContext> {
  const maturity = await computeGovernanceIndex();

  let activeRiskConfig: Record<string, unknown> = {};
  let clauseLibraryStats = ZERO_CLS;
  let solicitationStats = ZERO_SOL;
  let clauseReviewStats = ZERO_CR;
  let approvalStats = ZERO_AP;
  let auditStats = ZERO_AU;

  try {
    const configRows = (await query(`SELECT config_key, config_value FROM risk_model_config`)).rows as { config_key: string; config_value: unknown }[];
    activeRiskConfig = Object.fromEntries(configRows.map((r) => [r.config_key, r.config_value]));
  } catch {
    // table may not exist
  }

  try {
    const clauses = (await query(`SELECT type, category, suggested_risk_level, flow_down, active FROM clause_library_items`)).rows as { type?: string; category?: string; suggested_risk_level?: number; flow_down?: string; active?: boolean }[];
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byRiskLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const flowDownCounts: Record<string, number> = {};
    let activeCounts = 0;
    for (const c of clauses) {
      byType[c.type ?? 'OTHER'] = (byType[c.type ?? 'OTHER'] ?? 0) + 1;
      byCategory[c.category ?? 'OTHER'] = (byCategory[c.category ?? 'OTHER'] ?? 0) + 1;
      const rl = c.suggested_risk_level ?? 1;
      byRiskLevel[rl >= 1 && rl <= 4 ? rl : 1]++;
      flowDownCounts[c.flow_down ?? 'CONDITIONAL'] = (flowDownCounts[c.flow_down ?? 'CONDITIONAL'] ?? 0) + 1;
      if (c.active) activeCounts++;
    }
    clauseLibraryStats = { total: clauses.length, byType, byCategory, byRiskLevel, flowDownCounts, activeCounts };
  } catch {
    clauseLibraryStats = ZERO_CLS;
  }

  try {
    const totalSols = parseInt(((await query(`SELECT COUNT(*) as c FROM solicitations`)).rows[0] as { c: string })?.c ?? '0', 10);
    const withClauses = parseInt(((await query(
      `SELECT COUNT(DISTINCT s.id) as c FROM solicitations s
       INNER JOIN solicitation_versions sv ON sv.solicitation_id = s.id AND sv.version = s.current_version
       INNER JOIN clause_review_entries ce ON ce.version_id = sv.id`
    )).rows[0] as { c: string })?.c ?? '0', 10);
    const withAttest = parseInt(((await query(`SELECT COUNT(*) as c FROM solicitations WHERE no_clauses_attestation = true`)).rows[0] as { c: string })?.c ?? '0', 10);
    const withApprovals = parseInt(((await query(`SELECT COUNT(*) as c FROM solicitations WHERE status IN ('AWAITING_APPROVALS', 'FINALIZED')`)).rows[0] as { c: string })?.c ?? '0', 10);
    const finalized = parseInt(((await query(`SELECT COUNT(*) as c FROM solicitations WHERE status = 'FINALIZED'`)).rows[0] as { c: string })?.c ?? '0', 10);
    const finNoApproval = (await query(
      `SELECT s.id FROM solicitations s LEFT JOIN approvals a ON a.solicitation_id = s.id AND a.status = 'Approved'
       WHERE s.status = 'FINALIZED' GROUP BY s.id HAVING COUNT(a.id) = 0`
    )).rows.length;
    const escRows = (await query(`SELECT cyber_review_required, financial_review_required, escalation_required FROM solicitations WHERE escalation_required = true OR cyber_review_required = true OR financial_review_required = true`)).rows as { cyber_review_required?: boolean; financial_review_required?: boolean }[];
    const escalations = { cyber: 0, financial: 0, indemn: escRows.filter((r) => r.escalation_required).length, audit: 0 };
    for (const r of escRows) {
      if (r.cyber_review_required) escalations.cyber++;
      if (r.financial_review_required) escalations.financial++;
    }
    solicitationStats = {
      totalSolicitations: totalSols,
      withClauseReview: withClauses + withAttest,
      withApprovals,
      finalized,
      finalizedWithoutApprovals: finNoApproval,
      escalations
    };
  } catch {
    solicitationStats = ZERO_SOL;
  }

  try {
    const clauseRows = (await query(`SELECT risk_level, total_score FROM clause_review_entries`)).rows as { risk_level?: number; total_score?: number }[];
    const l1 = clauseRows.filter((c) => (c.risk_level ?? 1) === 1).length;
    const l2 = clauseRows.filter((c) => (c.risk_level ?? 1) === 2).length;
    const l3 = clauseRows.filter((c) => (c.risk_level ?? 1) === 3).length;
    const l4 = clauseRows.filter((c) => (c.risk_level ?? 1) === 4).length;
    const avgRisk = clauseRows.length > 0
      ? clauseRows.reduce((s, c) => s + ((c.total_score ?? 0) as number), 0) / clauseRows.length
      : 0;
    clauseReviewStats = { totalClausesReviewed: clauseRows.length, avgClauseRisk: avgRisk, l1, l2, l3, l4 };
  } catch {
    clauseReviewStats = ZERO_CR;
  }

  try {
    const approvRows = (await query(`SELECT approval_type, status FROM approvals`)).rows as { approval_type: string; status: string }[];
    const byType: Record<string, { approved: number; pending: number; rejected: number }> = {};
    for (const a of approvRows) {
      if (!byType[a.approval_type]) byType[a.approval_type] = { approved: 0, pending: 0, rejected: 0 };
      byType[a.approval_type][a.status === 'Approved' ? 'approved' : a.status === 'Rejected' ? 'rejected' : 'pending']++;
    }
    const total = approvRows.length;
    const approved = approvRows.filter((a) => a.status === 'Approved').length;
    approvalStats = { requiredApprovalsMetRate: total > 0 ? approved / total : 1, byType };
  } catch {
    approvalStats = ZERO_AP;
  }

  try {
    const totalSols = parseInt(((await query(`SELECT COUNT(*) as c FROM solicitations`)).rows[0] as { c: string })?.c ?? '0', 10);
    const solsWithAudit = parseInt(((await query(
      `SELECT COUNT(DISTINCT entity_id) as c FROM governance_audit_events WHERE entity_type = 'Solicitation' AND entity_id IN (SELECT id FROM solicitations)`
    )).rows[0] as { c: string })?.c ?? '0', 10);
    const totalEvents = parseInt(((await query(`SELECT COUNT(*) as c FROM governance_audit_events WHERE entity_type IN ('Solicitation', 'ClauseEntry')`)).rows[0] as { c: string })?.c ?? '0', 10);
    auditStats = {
      solicitationsWithAuditEventsRate: totalSols > 0 ? solsWithAudit / totalSols : 0,
      avgAuditEventsPerSolicitation: totalSols > 0 ? totalEvents / totalSols : 0
    };
  } catch {
    auditStats = ZERO_AU;
  }

  return {
    activeRiskConfig,
    clauseLibraryStats,
    solicitationStats,
    clauseReviewStats,
    approvalStats,
    auditStats,
    maturity
  };
}
