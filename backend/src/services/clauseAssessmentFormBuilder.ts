/**
 * Build MAC-FRM-013 clause assessment form payload for QMS.
 */
import { query } from '../db/connection.js';
import { getClauseWithOverlay } from './clauseService.js';

export interface ApprovalTrailStep {
  step: string;
  actor: string;
  role?: string;
  timestamp: string;
  decision: string;
}

export interface ClauseAssessmentFormPayload {
  sections: {
    solicitation: Record<string, unknown>;
    clause: Record<string, unknown>;
    applicability: Record<string, unknown>;
    riskInputs: Record<string, unknown>;
    riskOutputs: Record<string, unknown>;
    mitigations: Record<string, unknown>;
    approvals: Record<string, unknown>;
    recordControl: Record<string, unknown>;
  };
}

export async function buildClauseAssessmentFormPayload(
  solicitationId: string,
  solicitationClauseId: string
): Promise<ClauseAssessmentFormPayload | null> {
  const sol = (await query(
    `SELECT s.*, u.name as owner_name FROM solicitations s LEFT JOIN users u ON s.owner_id = u.id WHERE s.id = $1`,
    [solicitationId]
  )).rows[0] as Record<string, unknown> | undefined;
  if (!sol) return null;

  const scRow = (await query(
    `SELECT sc.*, rc.clause_number, rc.title, rc.regulation_type, rc.risk_category, rc.id as clause_id
     FROM solicitation_clauses sc JOIN regulatory_clauses rc ON sc.clause_id = rc.id
     WHERE sc.id = $1 AND sc.solicitation_id = $2`,
    [solicitationClauseId, solicitationId]
  )).rows[0] as Record<string, unknown> | undefined;
  if (!scRow) return null;

  const clauseId = scRow.clause_id as string;
  const clauseDto = await getClauseWithOverlay(clauseId);

  const craRow = (await query(
    `SELECT * FROM clause_risk_assessments
     WHERE solicitation_clause_id = $1 ORDER BY version DESC LIMIT 1`,
    [solicitationClauseId]
  )).rows[0] as Record<string, unknown> | undefined;

  const approvals = (await query(
    `SELECT a.*, u.name as approver_name, u.email as approver_email
     FROM approvals a LEFT JOIN users u ON a.approver_id = u.id
     WHERE a.solicitation_id = $1 ORDER BY a.approved_at`,
    [solicitationId]
  )).rows as Array<Record<string, unknown>>;

  let auditEvents: Array<Record<string, unknown>> = [];
  if (craRow?.id) {
    auditEvents = (await query(
      `SELECT g.*, u.name as actor_name, u.email as actor_email
       FROM governance_audit_events g LEFT JOIN users u ON g.actor_id = u.id
       WHERE g.entity_type = 'ClauseRiskAssessment' AND g.entity_id = $1
       ORDER BY g.created_at`,
      [craRow.id]
    )).rows as Array<Record<string, unknown>>;
  }

  const approvalTrail = buildApprovalTrail(approvals, auditEvents);

  return {
    sections: {
      solicitation: {
        solicitationNumber: sol.solicitation_number,
        title: sol.title,
        agency: sol.agency,
        customer: sol.customer,
        contractType: sol.contract_type,
        status: sol.status,
        anticipatedValue: sol.anticipated_value,
        dueDate: sol.due_date
      },
      clause: {
        clauseNumber: scRow.clause_number,
        title: scRow.title,
        regulationType: scRow.regulation_type,
        riskCategory: clauseDto?.effective_risk_category ?? scRow.risk_category,
        flowDownRequired: clauseDto?.effective_flow_down_required ?? scRow.is_flow_down_required
      },
      applicability: {
        detectedFrom: scRow.detected_from,
        isFlowDownRequired: scRow.is_flow_down_required
      },
      riskInputs: craRow ? {
        financial: craRow.base_risk_score ?? craRow.risk_score_percent,
        riskCategory: craRow.risk_category,
        rationale: craRow.rationale
      } : {},
      riskOutputs: craRow ? {
        riskLevel: craRow.risk_level,
        riskScorePercent: craRow.risk_score_percent,
        baseRiskScore: craRow.base_risk_score,
        assessedRiskScore: craRow.assessed_risk_score,
        effectiveFinalRiskScore: craRow.effective_final_risk_score,
        approvalTierRequired: craRow.approval_tier_required,
        status: craRow.status
      } : {},
      mitigations: craRow ? {
        recommendedMitigation: craRow.recommended_mitigation,
        effectiveMitigation: clauseDto?.effective_mitigation
      } : {},
      approvals: {
        approvalTrail,
        approvals: approvals.map((a) => ({
          type: a.approval_type,
          status: a.status,
          approver: a.approver_name ?? a.approver_email,
          approvedAt: a.approved_at,
          comment: a.comment
        }))
      },
      recordControl: {
        solicitationId,
        solicitationClauseId,
        clauseRiskAssessmentId: craRow?.id,
        governanceIds: { solicitationId, solicitationClauseId, clauseRiskAssessmentId: craRow?.id }
      }
    }
  };
}

function buildApprovalTrail(
  approvals: Array<Record<string, unknown>>,
  auditEvents: Array<Record<string, unknown>>
): ApprovalTrailStep[] {
  const steps: ApprovalTrailStep[] = [];

  for (const a of approvals) {
    steps.push({
      step: `Approval: ${a.approval_type}`,
      actor: String(a.approver_name ?? a.approver_email ?? a.approver_id ?? 'Unknown'),
      role: a.approval_type as string,
      timestamp: a.approved_at ? new Date(a.approved_at as string).toISOString() : '',
      decision: a.status as string
    });
  }

  const assessmentEvents = auditEvents.filter(
    (e) => e.entity_type === 'ClauseRiskAssessment' || (e.action && /assessment|approval/i.test(String(e.action)))
  );
  for (const e of assessmentEvents) {
    const action = e.action as string;
    if (steps.some((s) => s.step.includes(action))) continue;
    steps.push({
      step: action.replace(/_/g, ' '),
      actor: String(e.actor_name ?? e.actor_email ?? e.actor_id ?? 'System'),
      timestamp: e.created_at ? new Date(e.created_at as string).toISOString() : '',
      decision: action.includes('approve') ? 'Approved' : action.includes('reject') ? 'Rejected' : 'Submitted'
    });
  }

  return steps;
}
