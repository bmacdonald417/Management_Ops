/**
 * Governance Engine: Solicitation Clause Review + Risk Scoring + Clause Risk Log
 * Strict pre-bid workflow with gated approvals.
 */
import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { extractClausesFromText } from '../services/clauseExtractor.js';
import { searchClauses, getClauseByNumber, getClauseWithOverlay } from '../services/clauseService.js';
import { getApproveToBidBlockers, generateRiskLogSnapshot } from '../services/workflowEngine.js';
import { buildClauseAssessmentFormPayload } from '../services/clauseAssessmentFormBuilder.js';
import {
  qmsCreateFormRecord,
  qmsUpdateFormRecord,
  qmsFinalizeFormRecord,
  qmsListFormRecords,
  isQmsConfigured
} from '../services/qmsClient.js';
import { z } from 'zod';

const QMS_TEMPLATE_CODE = process.env.QMS_TEMPLATE_CODE_FOR_CLAUSE_ASSESSMENT ?? 'MAC-FRM-013';

const router = Router();
router.use(authenticate);

const CONTRACT_TYPES = ['FFP', 'CR', 'T&M', 'LH', 'BPA', 'IDIQ', 'Other'] as const;
const STATUSES = [
  'DRAFT', 'CLAUSE_EXTRACTION_PENDING', 'CLAUSE_EXTRACTION_COMPLETE',
  'REVIEW_IN_PROGRESS', 'REVIEW_COMPLETE', 'APPROVAL_REQUIRED',
  'APPROVED_TO_BID', 'REJECTED_NO_BID', 'ARCHIVED'
] as const;

function logAudit(entityType: string, entityId: string, action: string, actorId?: string, meta?: Record<string, unknown>) {
  return query(
    `INSERT INTO governance_audit_events (entity_type, entity_id, action, field_name, old_value, new_value, actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [entityType, entityId, action, meta ? 'metadata' : null, null, meta ? JSON.stringify(meta) : null, actorId]
  ).catch((e) => console.error('Audit log failed:', e));
}

function canApproveL4(role: string): boolean {
  return role === 'Level 1';
}
function canApproveL3(role: string): boolean {
  return ['Level 1', 'Level 2', 'Level 3'].includes(role);
}
function canManage(role: string): boolean {
  return ['Level 1', 'Level 2', 'Level 3', 'Level 4'].includes(role);
}

// POST /api/solicitations
router.post(
  '/',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const body = z.object({
      solicitationNumber: z.string().min(1),
      title: z.string().min(1),
      agency: z.string().min(1),
      customer: z.string().optional(),
      setAside: z.string().optional(),
      contractType: z.enum(CONTRACT_TYPES),
      anticipatedValue: z.number().optional(),
      periodOfPerformance: z.string().optional(),
      dueDate: z.string().optional(),
      sourceUrl: z.string().optional()
    }).parse(req.body);

    const userId = req.user?.id;
    const r = await query(
      `INSERT INTO solicitations (
        solicitation_number, title, agency, customer, set_aside, contract_type,
        anticipated_value, period_of_performance, due_date, source_url,
        owner_id, created_by_user_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11, $12, 'CLAUSE_EXTRACTION_PENDING')
      RETURNING *`,
      [
        body.solicitationNumber,
        body.title,
        body.agency,
        body.customer ?? null,
        body.setAside ?? null,
        body.contractType,
        body.anticipatedValue ?? null,
        body.periodOfPerformance ?? null,
        body.dueDate ?? null,
        body.sourceUrl ?? null,
        userId,
        userId
      ]
    );
    const row = r.rows[0] as { id: string };
    await logAudit('Solicitation', row.id, 'created', userId);
    res.status(201).json(row);
  }
);

// GET /api/solicitations/clause-library - regulatory clauses for manual add (via clauseService)
router.get('/clause-library', async (req, res) => {
  const { search, limit } = req.query;
  const queryStr = (search && typeof search === 'string') ? search : '';
  const lim = Math.min(parseInt((limit as string) || '100', 10), 500);
  const rows = await searchClauses(queryStr, {}, lim);
  res.json(rows.map((c) => ({ id: c.id, clause_number: c.clause_number, clauseNumber: c.clauseNumber, title: c.title, regulation_type: c.regulation_type, regulationType: c.regulationType })));
});

// GET /api/solicitations
router.get('/', async (req, res) => {
  const { status, dueDate } = req.query;
  let sql = `SELECT s.*, u.name as owner_name FROM solicitations s LEFT JOIN users u ON s.owner_id = u.id WHERE 1=1`;
  const params: unknown[] = [];
  let i = 1;
  if (status) {
    sql += ` AND s.status = $${i++}`;
    params.push(status);
  }
  if (dueDate) {
    sql += ` AND s.due_date <= $${i++}::date`;
    params.push(dueDate);
  }
  sql += ' ORDER BY s.updated_at DESC';
  const r = await query(sql, params);
  res.json(r.rows);
});

// GET /api/solicitations/:id/form-records
router.get('/:id/form-records', async (req, res) => {
  const { id } = req.params;
  const templateCode = (req.query.templateCode as string) ?? QMS_TEMPLATE_CODE;
  if (!isQmsConfigured()) {
    return res.json({ records: [], qmsConfigured: false });
  }
  const records = await qmsListFormRecords({
    relatedEntityType: 'SOLICITATION',
    relatedEntityId: id,
    templateCode
  });
  res.json({ records, qmsConfigured: true });
});

// GET /api/solicitations/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const sol = (await query(
    `SELECT s.*, u.name as owner_name FROM solicitations s LEFT JOIN users u ON s.owner_id = u.id WHERE s.id = $1`,
    [id]
  )).rows[0];
  if (!sol) return res.status(404).json({ error: 'Not found' });

  const clauses = await query(
    `SELECT sc.*, rc.clause_number, rc.title, rc.regulation_type, rc.risk_category, rc.flow_down_required,
      cra.id as assessment_id, cra.risk_level, cra.risk_score_percent, cra.status as assessment_status,
      cra.approval_tier_required
     FROM solicitation_clauses sc
     JOIN regulatory_clauses rc ON sc.clause_id = rc.id
     LEFT JOIN clause_risk_assessments cra ON cra.solicitation_clause_id = sc.id AND cra.id = (
       SELECT id FROM clause_risk_assessments WHERE solicitation_clause_id = sc.id ORDER BY version DESC LIMIT 1
     )
     WHERE sc.solicitation_id = $1`,
    [id]
  );

  const tasks = await query(`SELECT * FROM clause_review_tasks WHERE solicitation_id = $1 ORDER BY created_at`, [id]);
  const approvals = await query(`SELECT * FROM approvals WHERE solicitation_id = $1`, [id]);

  res.json({
    ...sol,
    solicitation_clauses: clauses.rows,
    review_tasks: tasks.rows,
    approvals: approvals.rows
  });
});

// PATCH /api/solicitations/:id
router.patch(
  '/:id',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [id])).rows[0] as { status: string } | undefined;
    if (!sol) return res.status(404).json({ error: 'Not found' });
    if (!['DRAFT', 'CLAUSE_EXTRACTION_PENDING'].includes(sol.status)) {
      return res.status(400).json({ error: 'Cannot edit solicitation in current status' });
    }

    const body = req.body;
    const map: Record<string, string> = {
      anticipatedValue: 'anticipated_value',
      periodOfPerformance: 'period_of_performance',
      dueDate: 'due_date',
      sourceUrl: 'source_url',
      setAside: 'set_aside',
      contractType: 'contract_type'
    };
    const allowed = ['title', 'agency', 'customer', 'set_aside', 'setAside', 'contract_type', 'contractType', 'anticipated_value', 'anticipatedValue', 'period_of_performance', 'periodOfPerformance', 'due_date', 'dueDate', 'source_url', 'sourceUrl', 'status'];
    const cols: string[] = [];
    const vals: unknown[] = [];
    let i = 2;
    for (const k of Object.keys(body)) {
      if (!allowed.includes(k)) continue;
      const col = map[k] || k;
      cols.push(`${col} = $${i++}`);
      vals.push(body[k]);
    }
    if (cols.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    const r = await query(
      `UPDATE solicitations SET ${cols.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...vals]
    );
    await logAudit('Solicitation', id, 'updated', req.user?.id);
    res.json(r.rows[0]);
  }
);

// POST /api/solicitations/:id/clauses/extract
router.post(
  '/:id/clauses/extract',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const { pastedText } = z.object({ pastedText: z.string() }).parse(req.body);
    const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [id])).rows[0] as { status: string } | undefined;
    if (!sol) return res.status(404).json({ error: 'Not found' });

    const extracted = extractClausesFromText(pastedText);
    const added: unknown[] = [];

    for (const e of extracted) {
      const clauseDto = await getClauseByNumber(e.regulationType, e.clauseNumber);
      if (!clauseDto) continue;

      try {
        const ins = await query(
          `INSERT INTO solicitation_clauses (solicitation_id, clause_id, detected_from, detected_confidence, is_flow_down_required)
           VALUES ($1, $2, 'PASTED_TEXT', 0.9, $3)
           ON CONFLICT (solicitation_id, clause_id) DO NOTHING
           RETURNING *`,
          [id, clauseDto.id, clauseDto.effective_flow_down_required]
        );
        if (ins.rows[0]) {
          added.push(ins.rows[0]);
          await logAudit('SolicitationClause', (ins.rows[0] as { id: string }).id, 'clause_added', req.user?.id, { source: 'extract', clauseId: clauseDto.id });
        }
      } catch {
        // skip dup
      }
    }

    await query(
      `UPDATE solicitations SET status = 'CLAUSE_EXTRACTION_COMPLETE', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    await logAudit('Solicitation', id, 'clauses_extracted', req.user?.id, { count: added.length });
    res.json({ extracted: extracted.length, added: added.length, clauses: added });
  }
);

// POST /api/solicitations/:id/clauses/manual
router.post(
  '/:id/clauses/manual',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const { clauseId } = z.object({ clauseId: z.string().uuid() }).parse(req.body);
    const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [id])).rows[0];
    if (!sol) return res.status(404).json({ error: 'Not found' });

    const clauseDto = await getClauseWithOverlay(clauseId);
    if (!clauseDto) return res.status(404).json({ error: 'Clause not found' });

    const r = await query(
      `INSERT INTO solicitation_clauses (solicitation_id, clause_id, detected_from, is_flow_down_required)
       VALUES ($1, $2, 'MANUAL_ADD', $3)
       ON CONFLICT (solicitation_id, clause_id) DO NOTHING
       RETURNING *`,
      [id, clauseId, clauseDto.effective_flow_down_required]
    );
    if (!r.rows[0]) return res.status(409).json({ error: 'Clause already added' });
    await logAudit('SolicitationClause', (r.rows[0] as { id: string }).id, 'clause_added', req.user?.id, { source: 'manual', clauseId });
    res.status(201).json(r.rows[0]);
  }
);

// POST /api/solicitations/:id/approve-to-bid (blocker logic in workflowEngine)
router.post(
  '/:id/approve-to-bid',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  async (req, res) => {
    const { id } = req.params;
    const result = await getApproveToBidBlockers(id);
    if (!result.canApprove) {
      await logAudit('Solicitation', id, 'approve_to_bid_attempted', req.user?.id, { blocked: true, blockerCount: result.blockers.length });
      return res.status(400).json({
        error: 'Cannot approve to bid',
        canApprove: false,
        blockers: result.blockers,
        hint: 'Complete clause extraction, risk assessments, flowdown review, required approvals, and generate a fresh Clause Risk Log'
      });
    }
    await query(
      `UPDATE solicitations SET status = 'APPROVED_TO_BID', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    await logAudit('Solicitation', id, 'approved_to_bid', req.user?.id);
    res.json({ ok: true, canApprove: true });
  }
);

// GET /api/solicitations/:id/approve-to-bid/blockers
router.get('/:id/approve-to-bid/blockers', async (req, res) => {
  const { id } = req.params;
  const r = await getApproveToBidBlockers(id);
  res.json(r);
});

// POST /api/solicitations/:id/risk-log/generate (logic in workflowEngine)
router.post(
  '/:id/risk-log/generate',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [id])).rows[0];
    if (!sol) return res.status(404).json({ error: 'Not found' });
    const snapshot = await generateRiskLogSnapshot(id, req.user?.id ?? null);
    await logAudit('Solicitation', id, 'risk_log_generated', req.user?.id);
    res.status(201).json(snapshot);
  }
);

// GET /api/solicitations/:id/risk-log/latest
router.get('/:id/risk-log/latest', async (req, res) => {
  const { id } = req.params;
  const r = await query(
    `SELECT * FROM clause_risk_log_snapshots WHERE solicitation_id = $1 ORDER BY generated_at DESC LIMIT 1`,
    [id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'No risk log found' });
  res.json(r.rows[0]);
});

// POST /api/solicitations/:id/clauses/:scId/form-record/save-draft
router.post(
  '/:id/clauses/:scId/form-record/save-draft',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id, scId } = req.params;
    if (!isQmsConfigured()) {
      return res.status(503).json({ error: 'QMS not configured', qmsConfigured: false });
    }
    const sc = (await query(
      `SELECT id FROM solicitation_clauses WHERE solicitation_id = $1 AND id = $2`,
      [id, scId]
    )).rows[0];
    if (!sc) return res.status(404).json({ error: 'Not found' });

    const craRow = (await query(
      `SELECT id FROM clause_risk_assessments WHERE solicitation_clause_id = $1 ORDER BY version DESC LIMIT 1`,
      [scId]
    )).rows[0] as { id: string } | undefined;
    if (!craRow) return res.status(400).json({ error: 'No assessment exists for this clause. Assess the clause first.' });

    const payload = await buildClauseAssessmentFormPayload(id, scId);
    if (!payload) return res.status(404).json({ error: 'Could not build form payload' });

    const linkRow = (await query(
      `SELECT id, qms_form_record_id FROM clause_assessment_form_links WHERE clause_risk_assessment_id = $1`,
      [craRow.id]
    )).rows[0] as { id: string; qms_form_record_id: string } | undefined;

    const payloadObj = payload as unknown as Record<string, unknown>;
    let qmsFormRecordId: string;
    if (linkRow) {
      const updated = await qmsUpdateFormRecord(linkRow.qms_form_record_id, {
        status: 'DRAFT',
        payload: payloadObj,
        relatedEntityType: 'SOLICITATION',
        relatedEntityId: id
      });
      if (!updated) return res.status(502).json({ error: 'QMS update failed. Retry later.', qmsConfigured: true });
      qmsFormRecordId = linkRow.qms_form_record_id;
      await query(
        `UPDATE clause_assessment_form_links SET updated_at = NOW() WHERE id = $1`,
        [linkRow.id]
      );
    } else {
      const created = await qmsCreateFormRecord({
        templateCode: QMS_TEMPLATE_CODE,
        status: 'DRAFT',
        relatedEntityType: 'SOLICITATION',
        relatedEntityId: id,
        payload: payloadObj
      });
      if (!created) return res.status(502).json({ error: 'QMS create failed. Retry later.', qmsConfigured: true });
      qmsFormRecordId = created.id;
      await query(
        `INSERT INTO clause_assessment_form_links (solicitation_id, solicitation_clause_id, clause_risk_assessment_id, qms_form_record_id, template_code, status)
         VALUES ($1, $2, $3, $4, $5, 'DRAFT')`,
        [id, scId, craRow.id, qmsFormRecordId, QMS_TEMPLATE_CODE]
      );
    }
    await logAudit('ClauseAssessmentFormLink', qmsFormRecordId, 'qms_draft_saved', req.user?.id, { solicitationId: id, solicitationClauseId: scId });
    res.json({ qmsFormRecordId, status: 'DRAFT' });
  }
);

// POST /api/solicitations/:id/clauses/:scId/form-record/finalize
router.post(
  '/:id/clauses/:scId/form-record/finalize',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id, scId } = req.params;
    if (!isQmsConfigured()) {
      return res.status(503).json({ error: 'QMS not configured', qmsConfigured: false });
    }
    const sc = (await query(
      `SELECT id FROM solicitation_clauses WHERE solicitation_id = $1 AND id = $2`,
      [id, scId]
    )).rows[0];
    if (!sc) return res.status(404).json({ error: 'Not found' });

    const craRow = (await query(
      `SELECT id, status FROM clause_risk_assessments WHERE solicitation_clause_id = $1 ORDER BY version DESC LIMIT 1`,
      [scId]
    )).rows[0] as { id: string; status: string } | undefined;
    if (!craRow) return res.status(400).json({ error: 'No assessment exists for this clause.' });
    if (craRow.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Governance approvals must be complete before finalizing to QMS.' });
    }

    const linkRow = (await query(
      `SELECT id, qms_form_record_id FROM clause_assessment_form_links WHERE clause_risk_assessment_id = $1`,
      [craRow.id]
    )).rows[0] as { id: string; qms_form_record_id: string } | undefined;
    if (!linkRow) return res.status(400).json({ error: 'No QMS draft record. Save draft first.' });

    const payload = await buildClauseAssessmentFormPayload(id, scId);
    if (!payload) return res.status(404).json({ error: 'Could not build form payload' });

    const approvalTrail = (payload.sections.approvals.approvalTrail as Array<{ step: string; actor: string; role?: string; timestamp: string; decision: string }>) ?? [];
    const finalized = await qmsFinalizeFormRecord(linkRow.qms_form_record_id, {
      approvalTrail,
      payload: payload as unknown as Record<string, unknown>
    });
    if (!finalized) return res.status(502).json({ error: 'QMS finalize failed. Retry later.', qmsConfigured: true });

    await query(
      `UPDATE clause_assessment_form_links SET status = 'FINAL', updated_at = NOW() WHERE id = $1`,
      [linkRow.id]
    );
    await logAudit('ClauseAssessmentFormLink', linkRow.qms_form_record_id, 'qms_finalized', req.user?.id, { solicitationId: id, solicitationClauseId: scId });
    res.json({
      qmsFormRecordId: finalized.id,
      status: 'FINAL',
      recordNumber: finalized.recordNumber,
      pdfUrl: finalized.pdfUrl
    });
  }
);

// GET /api/solicitations/:id/clauses/:scId/form-record
router.get('/:id/clauses/:scId/form-record', async (req, res) => {
  const { id, scId } = req.params;
  const linkRow = (await query(
    `SELECT caf.* FROM clause_assessment_form_links caf
     JOIN solicitation_clauses sc ON sc.id = caf.solicitation_clause_id
     WHERE caf.solicitation_id = $1 AND caf.solicitation_clause_id = $2
     ORDER BY caf.updated_at DESC LIMIT 1`,
    [id, scId]
  )).rows[0];
  if (!linkRow) return res.json({ link: null, qmsConfigured: isQmsConfigured() });
  res.json({
    link: {
      qmsFormRecordId: linkRow.qms_form_record_id,
      status: linkRow.status,
      templateCode: linkRow.template_code
    },
    qmsConfigured: isQmsConfigured()
  });
});

// DELETE /api/solicitations/:id/clauses/:scId
router.delete(
  '/:id/clauses/:scId',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id, scId } = req.params;
    const sc = (await query(
      `SELECT id FROM solicitation_clauses WHERE solicitation_id = $1 AND id = $2`,
      [id, scId]
    )).rows[0];
    if (!sc) return res.status(404).json({ error: 'Not found' });
    await query(`DELETE FROM solicitation_clauses WHERE id = $1`, [scId]);
    await logAudit('SolicitationClause', scId, 'clause_removed', req.user?.id);
    res.status(204).send();
  }
);

// GET /api/solicitations/:id/completeness
router.get('/:id/completeness', async (req, res) => {
  const { id } = req.params;
  const clauses = (await query(
    `SELECT sc.id, cra.status FROM solicitation_clauses sc
     LEFT JOIN LATERAL (SELECT status FROM clause_risk_assessments WHERE solicitation_clause_id = sc.id ORDER BY version DESC LIMIT 1) cra ON true
     WHERE sc.solicitation_id = $1`,
    [id]
  )).rows as { status: string }[];

  const total = clauses.length;
  const assessed = clauses.filter((c) => c.status === 'APPROVED').length;
  const pct = total > 0 ? Math.round((assessed / total) * 100) : 0;
  const missing = total - assessed;

  await query(
    `INSERT INTO governance_completeness_index (scope, solicitation_id, percent_complete, missing_items_json, last_calculated_at)
     VALUES ('SOLICITATION', $1, $2, $3, NOW())
     ON CONFLICT (scope, solicitation_id) DO UPDATE SET
       percent_complete = EXCLUDED.percent_complete,
       missing_items_json = EXCLUDED.missing_items_json,
       last_calculated_at = NOW()`,
    [id, pct, JSON.stringify({ missingAssessments: missing })]
  ).catch(() => {});

  res.json({
    percentComplete: pct,
    totalClauses: total,
    assessedCount: assessed,
    missingItems: { missingAssessments: missing }
  });
});

export default router;
