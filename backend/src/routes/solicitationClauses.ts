/**
 * Solicitation clause assessment and approval routes.
 * POST /api/solicitation-clauses/:id/assess
 * POST /api/solicitation-clauses/:id/approve
 */
import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { assessClauseRisk, type RiskFactorScores } from '../services/solicitationRiskEngine.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

function logAudit(entityType: string, entityId: string, action: string, actorId?: string) {
  return query(
    `INSERT INTO governance_audit_events (entity_type, entity_id, action, actor_id)
     VALUES ($1, $2, $3, $4)`,
    [entityType, entityId, action, actorId]
  ).catch((e) => console.error('Audit log failed:', e));
}

function canApproveL4(role: string): boolean {
  return role === 'Level 1';
}
function canApproveL3(role: string): boolean {
  return ['Level 1', 'Level 2', 'Level 3'].includes(role);
}

// POST /api/solicitation-clauses/:id/assess
router.post(
  '/:id/assess',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const scId = req.params.id;
    const body = z.object({
      financial: z.number().min(0).max(5).optional(),
      schedule: z.number().min(0).max(5).optional(),
      audit: z.number().min(0).max(5).optional(),
      cyber: z.number().min(0).max(5).optional(),
      flowDown: z.number().min(0).max(5).optional(),
      insurance: z.number().min(0).max(5).optional(),
      ip: z.number().min(0).max(5).optional(),
      rationale: z.string().optional(),
      recommendedMitigation: z.string().optional(),
      requiresFlowDown: z.boolean().optional()
    }).parse(req.body);

    const sc = (await query(
      `SELECT sc.*, rc.clause_number, rc.risk_category FROM solicitation_clauses sc
       JOIN regulatory_clauses rc ON sc.clause_id = rc.id WHERE sc.id = $1`,
      [scId]
    )).rows[0] as { solicitation_id: string; clause_number: string; risk_category: string } | undefined;
    if (!sc) return res.status(404).json({ error: 'Not found' });

    const sol = (await query(`SELECT contract_type FROM solicitations WHERE id = $1`, [sc.solicitation_id])).rows[0] as { contract_type: string } | undefined;
    const scores: RiskFactorScores = {
      financial: body.financial ?? 2,
      schedule: body.schedule ?? 2,
      audit: body.audit ?? 2,
      cyber: body.cyber ?? 2,
      flowDown: body.flowDown ?? 2,
      insurance: body.insurance ?? 2,
      ip: body.ip ?? 2
    };
    const result = assessClauseRisk({
      clauseNumber: sc.clause_number,
      scores,
      riskCategory: sc.risk_category || 'Other',
      rationale: body.rationale,
      requiresFlowDown: body.requiresFlowDown ?? false,
      contractType: sol?.contract_type
    });

    const autoApprove = result.approvalTierRequired === 'NONE';
    const status = autoApprove ? 'APPROVED' : 'SUBMITTED';
    const r = await query(
      `INSERT INTO clause_risk_assessments (
        solicitation_clause_id, risk_level, risk_score_percent, risk_category,
        rationale, recommended_mitigation, requires_flow_down, approval_tier_required,
        status, assessed_by_user_id, assessed_at, approved_by_user_id, approved_at, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, 1)
      RETURNING *`,
      [
        scId,
        result.riskLevel,
        result.riskScorePercent,
        sc.risk_category || 'Other',
        body.rationale ?? result.rationale,
        body.recommendedMitigation ?? null,
        body.requiresFlowDown ?? false,
        result.approvalTierRequired,
        status,
        req.user?.id,
        autoApprove ? req.user?.id : null,
        autoApprove ? new Date() : null
      ]
    );
    await logAudit('ClauseRiskAssessment', (r.rows[0] as { id: string }).id, 'submitted', req.user?.id);
    res.status(201).json(r.rows[0]);
  }
);

// POST /api/solicitation-clauses/:id/approve
router.post(
  '/:id/approve',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  async (req, res) => {
    const scId = req.params.id;
    const { status, comment } = z.object({
      status: z.enum(['Approved', 'Rejected']),
      comment: z.string().optional()
    }).parse(req.body);

    const sc = (await query(
      `SELECT sc.*, rc.clause_number FROM solicitation_clauses sc
       JOIN regulatory_clauses rc ON sc.clause_id = rc.id WHERE sc.id = $1`,
      [scId]
    )).rows[0] as { solicitation_id: string } | undefined;
    if (!sc) return res.status(404).json({ error: 'Not found' });

    const latest = (await query(
      `SELECT id, risk_level, approval_tier_required FROM clause_risk_assessments
       WHERE solicitation_clause_id = $1 ORDER BY version DESC LIMIT 1`,
      [scId]
    )).rows[0] as { id: string; risk_level: string; approval_tier_required: string } | undefined;
    if (!latest) return res.status(400).json({ error: 'No assessment to approve' });
    if (latest.risk_level !== 'L3' && latest.risk_level !== 'L4') {
      return res.status(400).json({ error: 'Only L3/L4 assessments require explicit approval' });
    }

    const role = req.user?.role ?? '';
    if (latest.risk_level === 'L4' && !canApproveL4(role)) {
      return res.status(403).json({ error: 'L4 requires Level 1 (Executive) approval' });
    }
    if (latest.risk_level === 'L3' && !canApproveL3(role)) {
      return res.status(403).json({ error: 'L3 requires Manager or Quality approval' });
    }

    await query(
      `UPDATE clause_risk_assessments SET status = $2, approved_by_user_id = $3, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [latest.id, status, req.user?.id]
    );

    // Create/update approval record for solicitation
    const approvalType = latest.risk_level === 'L4' ? 'Executive' : 'Quality';
    const existing = (await query(
      `SELECT id FROM approvals WHERE solicitation_id = $1 AND approval_type = $2`,
      [sc.solicitation_id, approvalType]
    )).rows[0];
    if (existing) {
      await query(
        `UPDATE approvals SET status = $2, approver_id = $3, approved_at = NOW(), comment = $4 WHERE id = $1`,
        [existing.id, status, req.user?.id, comment ?? null]
      );
    } else {
      await query(
        `INSERT INTO approvals (solicitation_id, approval_type, status, approver_id, approved_at, comment)
         VALUES ($1, $2, $3, $4, NOW(), $5)`,
        [sc.solicitation_id, approvalType, status, req.user?.id, comment ?? null]
      );
    }

    await logAudit('ClauseRiskAssessment', latest.id, `approval_${status.toLowerCase()}`, req.user?.id);
    res.json({ ok: true });
  }
);

export default router;
