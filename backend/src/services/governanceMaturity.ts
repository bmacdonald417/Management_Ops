import { query } from '../db/connection.js';
import { getKBStats } from './complianceKB/stats.js';

export interface MaturityMetrics {
  reviewRate: number;
  approvalCompliance: number;
  escalationResolutionRate: number;
  lockIntegrity: number;
  auditCoverage: number;
  clauseLibraryUsage: number;
  solicitationsWithoutClauseReview: number;
  finalizedWithoutApproval: number;
  clausesNotFromLibrary: number;
  escalationsNoApproval: number;
  executiveBriefCoverage: number;
  copilotEnrichmentCount: number;
  copilotApprovedByQualityRate: number;
}

export interface MaturityResult {
  overallScore: number;
  pillarContract: number;
  pillarFinancial: number;
  pillarCyber: number;
  pillarInsurance: number;
  pillarStructural: number;
  pillarAudit: number;
  pillarDocumentation: number;
  metrics: MaturityMetrics;
  gapTable: { metricName: string; currentPct: number; targetPct: number; delta: number }[];
  disconnectIndicators: string[];
}

const TARGET = 85;

export async function computeGovernanceIndex(): Promise<MaturityResult> {
  const metrics: MaturityMetrics = {
    reviewRate: 0,
    approvalCompliance: 0,
    escalationResolutionRate: 0,
    lockIntegrity: 0,
    auditCoverage: 0,
    clauseLibraryUsage: 0,
    solicitationsWithoutClauseReview: 0,
    finalizedWithoutApproval: 0,
    clausesNotFromLibrary: 0,
    escalationsNoApproval: 0,
    executiveBriefCoverage: 0,
    copilotEnrichmentCount: 0,
    copilotApprovedByQualityRate: 0
  };

  const disconnectIndicators: string[] = [];

  try {
    const totalSols = (await query(
      `SELECT COUNT(*) as c FROM solicitations`
    )).rows[0] as { c: string };
    const totalSolicitations = parseInt(totalSols?.c ?? '0', 10);

    if (totalSolicitations === 0) {
      return buildResult(metrics, disconnectIndicators, [
        { metricName: 'No solicitations in system', currentPct: 0, targetPct: TARGET, delta: -TARGET }
      ]);
    }

    const solsWithClauses = (await query(
      `SELECT COUNT(DISTINCT s.id) as c FROM solicitations s
       INNER JOIN solicitation_clauses sc ON sc.solicitation_id = s.id`
    )).rows[0] as { c: string };
    const solsWithAttestation = (await query(
      `SELECT COUNT(*) as c FROM solicitations WHERE no_clauses_attestation = true`
    )).rows[0] as { c: string };
    const solsWithClauseReview = parseInt(solsWithClauses?.c ?? '0', 10) + parseInt(solsWithAttestation?.c ?? '0', 10);
    metrics.reviewRate = totalSolicitations > 0 ? solsWithClauseReview / totalSolicitations : 0;
    if (solsWithClauseReview < totalSolicitations) {
      disconnectIndicators.push(`Solicitations without clause review (${totalSolicitations - solsWithClauseReview})`);
    }
    metrics.solicitationsWithoutClauseReview = totalSolicitations - solsWithClauseReview;

    const submitted = (await query(
      `SELECT id FROM solicitations WHERE status IN ('AWAITING_APPROVALS', 'FINALIZED')`
    )).rows as { id: string }[];
    const submittedIds = submitted.map((r) => r.id);

    let requiredApprovals = 0;
    let approvedRequired = 0;
    if (submittedIds.length > 0) {
      const approvs = (await query(
        `SELECT solicitation_id, approval_type, status FROM approvals WHERE solicitation_id = ANY($1)`,
        [submittedIds]
      )).rows as { solicitation_id: string; approval_type: string; status: string }[];
      requiredApprovals = approvs.length;
      approvedRequired = approvs.filter((a) => a.status === 'Approved').length;
    }
    metrics.approvalCompliance = requiredApprovals > 0 ? approvedRequired / requiredApprovals : 1;

    const finalized = (await query(
      `SELECT id FROM solicitations WHERE status = 'FINALIZED'`
    )).rows as { id: string }[];
    const finalizedWithoutApprovalRows = await query(
      `SELECT s.id FROM solicitations s
       LEFT JOIN approvals a ON a.solicitation_id = s.id AND a.status = 'Approved'
       WHERE s.status = 'FINALIZED'
       GROUP BY s.id
       HAVING COUNT(a.id) = 0`
    );
    metrics.finalizedWithoutApproval = finalizedWithoutApprovalRows.rows.length;
    if (metrics.finalizedWithoutApproval > 0) {
      disconnectIndicators.push(`Finalized without approval (${metrics.finalizedWithoutApproval})`);
    }

    const totalEscalations = (await query(
      `SELECT COUNT(*) as c FROM solicitations WHERE escalation_required = true`
    )).rows[0] as { c: string };
    const resolvedEscalations = (await query(
      `SELECT COUNT(DISTINCT s.id) as c FROM solicitations s
       INNER JOIN approvals a ON a.solicitation_id = s.id AND a.status = 'Approved'
       WHERE s.escalation_required = true AND s.status = 'FINALIZED'`
    )).rows[0] as { c: string };
    const totEsc = parseInt(totalEscalations?.c ?? '0', 10);
    const resEsc = parseInt(resolvedEscalations?.c ?? '0', 10);
    metrics.escalationResolutionRate = totEsc > 0 ? resEsc / totEsc : 1;
    if (totEsc > resEsc && totEsc > 0) {
      disconnectIndicators.push(`Escalations triggered but no approval logged (${totEsc - resEsc})`);
    }
    metrics.escalationsNoApproval = totEsc - resEsc;

    const totalFinalized = finalized.length;
    const finalizedLocked = (await query(
      `SELECT COUNT(*) as c FROM solicitations WHERE status = 'FINALIZED' AND finalized_at IS NOT NULL`
    )).rows[0] as { c: string };
    const finLocked = parseInt(finalizedLocked?.c ?? '0', 10);
    metrics.lockIntegrity = totalFinalized > 0 ? finLocked / totalFinalized : 1;

    const solsWithAudit = (await query(
      `SELECT COUNT(DISTINCT entity_id) as c FROM governance_audit_events
       WHERE entity_type = 'Solicitation' AND entity_id IN (SELECT id FROM solicitations)`
    )).rows[0] as { c: string };
    metrics.auditCoverage = totalSolicitations > 0 ? parseInt(solsWithAudit?.c ?? '0', 10) / totalSolicitations : 0;

    const totalClauses = (await query(
      `SELECT COUNT(*) as c FROM solicitation_clauses`
    )).rows[0] as { c: string };
    const totCl = parseInt(totalClauses?.c ?? '0', 10);
    metrics.clauseLibraryUsage = totCl > 0 ? 1 : 1;
    metrics.clausesNotFromLibrary = 0;

    const kbStats = await getKBStats();
    if (kbStats.chunksCount > 0 && kbStats.embeddingCoverage < 0.8) {
      const pct = Math.round(kbStats.embeddingCoverage * 100);
      disconnectIndicators.push(`Knowledge base embedding coverage low (${pct}% - run embeddings)`);
    }

    try {
      const solsWithBrief = (await query(
        `SELECT COUNT(DISTINCT (payload_json->>'solicitationId')) as c FROM copilot_runs WHERE mode = 'EXECUTIVE_BRIEF'`
      )).rows[0] as { c: string };
      const briefCount = parseInt(solsWithBrief?.c ?? '0', 10);
      metrics.executiveBriefCoverage = totalSolicitations > 0 ? Math.min(1, briefCount / totalSolicitations) : 0;

      const enrichCount = (await query(
        `SELECT COUNT(*) as c FROM governance_audit_events WHERE entity_type = 'ClauseLibraryItem' AND new_value = 'clause_enrich'`
      )).rows[0] as { c: string };
      metrics.copilotEnrichmentCount = parseInt(enrichCount?.c ?? '0', 10);

      const totalApply = (await query(
        `SELECT COUNT(*) as c FROM governance_audit_events WHERE field_name = 'copilot_apply'`
      )).rows[0] as { c: string };
      const qualityApproved = (await query(
        `SELECT COUNT(*) as c FROM governance_audit_events e
         JOIN users u ON u.id = e.actor_id
         WHERE e.field_name = 'copilot_apply' AND u.role = 'Level 3'`
      )).rows[0] as { c: string };
      const total = parseInt(totalApply?.c ?? '0', 10);
      metrics.copilotApprovedByQualityRate = total > 0 ? parseInt(qualityApproved?.c ?? '0', 10) / total : 0;
    } catch {
      // copilot_runs table may not exist yet
    }
  } catch (err) {
    console.error('Governance maturity compute error:', err);
    return buildResult(metrics, ['Error computing metrics'], []);
  }

  const gapTable = [
    { metricName: 'Review Rate', currentPct: Math.round(metrics.reviewRate * 100), targetPct: TARGET, delta: Math.round(metrics.reviewRate * 100) - TARGET },
    { metricName: 'Executive Brief Coverage', currentPct: Math.round(metrics.executiveBriefCoverage * 100), targetPct: 50, delta: Math.round(metrics.executiveBriefCoverage * 100) - 50 },
    { metricName: 'Copilot Approved by Quality', currentPct: Math.round(metrics.copilotApprovedByQualityRate * 100), targetPct: 50, delta: Math.round(metrics.copilotApprovedByQualityRate * 100) - 50 },
    { metricName: 'Approval Compliance', currentPct: Math.round(metrics.approvalCompliance * 100), targetPct: TARGET, delta: Math.round(metrics.approvalCompliance * 100) - TARGET },
    { metricName: 'Escalation Resolution', currentPct: Math.round(metrics.escalationResolutionRate * 100), targetPct: TARGET, delta: Math.round(metrics.escalationResolutionRate * 100) - TARGET },
    { metricName: 'Lock Integrity', currentPct: Math.round(metrics.lockIntegrity * 100), targetPct: TARGET, delta: Math.round(metrics.lockIntegrity * 100) - TARGET },
    { metricName: 'Audit Coverage', currentPct: Math.round(metrics.auditCoverage * 100), targetPct: TARGET, delta: Math.round(metrics.auditCoverage * 100) - TARGET },
    { metricName: 'Clause Library Usage', currentPct: Math.round(metrics.clauseLibraryUsage * 100), targetPct: TARGET, delta: Math.round(metrics.clauseLibraryUsage * 100) - TARGET }
  ];

  return buildResult(metrics, disconnectIndicators, gapTable);
}

function buildResult(
  metrics: MaturityMetrics,
  disconnectIndicators: string[],
  gapTable: { metricName: string; currentPct: number; targetPct: number; delta: number }[]
): MaturityResult {
  const pillarContract = (metrics.reviewRate + metrics.clauseLibraryUsage) / 2 * 20;
  const pillarFinancial = metrics.approvalCompliance * 20;
  const pillarCyber = (metrics.lockIntegrity + metrics.auditCoverage) / 2 * 20;
  const pillarInsurance = metrics.lockIntegrity * 20;
  const pillarStructural = metrics.reviewRate * 20;
  const pillarAudit = (metrics.auditCoverage + metrics.approvalCompliance) / 2 * 20;
  const pillarDocumentation = metrics.auditCoverage * 20;

  const pillars = [pillarContract, pillarFinancial, pillarCyber, pillarInsurance, pillarStructural, pillarAudit, pillarDocumentation];
  const overallScore = Math.min(100, pillars.reduce((s, p) => s + p, 0));

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    pillarContract: Math.round(pillarContract * 10) / 10,
    pillarFinancial: Math.round(pillarFinancial * 10) / 10,
    pillarCyber: Math.round(pillarCyber * 10) / 10,
    pillarInsurance: Math.round(pillarInsurance * 10) / 10,
    pillarStructural: Math.round(pillarStructural * 10) / 10,
    pillarAudit: Math.round(pillarAudit * 10) / 10,
    pillarDocumentation: Math.round(pillarDocumentation * 10) / 10,
    metrics,
    gapTable: gapTable.length > 0 ? gapTable : [
      { metricName: 'No data', currentPct: 0, targetPct: TARGET, delta: -TARGET }
    ],
    disconnectIndicators
  };
}

export function registerMetric(
  _pillar: string,
  _metricName: string,
  _value: number
): void {
  // Future hook: when Cyber/Financial modules expand, call this to plug in metrics
  // The scoring engine will aggregate registered metrics per pillar
}
