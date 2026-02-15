import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  computeClauseScore,
  scoreToRiskLevel,
  checkClauseEscalation,
  computeSolicitationRisk,
  checkSolicitationEscalations,
  CLAUSE_CATEGORIES,
  CONTRACT_TYPES
} from '../services/governanceScoring.js';
import { computeGovernanceIndex } from '../services/governanceMaturity.js';
import { loadAutoBuilderContext } from '../services/autoBuilder/context.js';
import { generateManualMarkdown, generateEvidenceMarkdown } from '../services/autoBuilder/generate.js';
import { SECTION_REGISTRY, APPENDIX_LIST } from '../services/autoBuilder/sectionRegistry.js';
import { getImproveLinks } from '../services/autoBuilder/maturityBridge.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

function logAudit(
  entityType: string,
  entityId: string,
  action: string,
  actorId: string | undefined,
  fieldName?: string,
  oldVal?: string,
  newVal?: string
) {
  return query(
    `INSERT INTO governance_audit_events (entity_type, entity_id, action, field_name, old_value, new_value, actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [entityType, entityId, action, fieldName ?? null, oldVal ?? null, newVal ?? null, actorId]
  );
}

function canEdit(userRole: string, ownerId: string | null, userId: string): boolean {
  if (['Level 1', 'Level 2'].includes(userRole)) return true;
  if (userRole === 'Level 3') return true;
  if (userRole === 'Level 4' && ownerId === userId) return true;
  return false;
}

function canApprove(userRole: string): boolean {
  return ['Level 1', 'Level 2', 'Level 3'].includes(userRole);
}

function canFinalize(userRole: string): boolean {
  return ['Level 1', 'Level 2', 'Level 3'].includes(userRole);
}

const GOVERNANCE_STRICT_MODE = process.env.GOVERNANCE_STRICT_MODE === 'true' || process.env.GOVERNANCE_STRICT_MODE === '1';

/** Normalize clause number for lookup (e.g. "FAR 52.203-13" -> "52.203-13") */
function normalizeClauseForLookup(cn: string): string {
  return cn.replace(/^(FAR|DFARS)\s*/i, '').replace(/\s+/g, '').trim();
}

/** When strict mode: require clause to exist in regulatory_clauses with risk_category, risk_score, flow_down_required */
async function validateClauseForStrictMode(clauseNumber: string): Promise<{ ok: boolean; error?: string }> {
  if (!GOVERNANCE_STRICT_MODE) return { ok: true };
  const normalized = normalizeClauseForLookup(clauseNumber);
  if (!normalized) return { ok: false, error: 'Invalid clause number' };
  const r = (await query(
    `SELECT risk_category, risk_score, flow_down_required FROM regulatory_clauses
     WHERE clause_number = $1`,
    [normalized]
  )).rows[0] as { risk_category: string | null; risk_score: number | null; flow_down_required: boolean } | undefined;
  if (!r) {
    return { ok: false, error: `Clause ${clauseNumber} must be in Regulatory Library (run reg:ingest). Strict mode requires risk classification.` };
  }
  if (r.risk_category == null || r.risk_score == null) {
    return { ok: false, error: `Clause ${clauseNumber} is missing risk classification (risk_category, risk_score). Re-run reg:ingest.` };
  }
  return { ok: true };
}

// Get risk model config
router.get('/config', async (_req, res) => {
  const r = await query(
    `SELECT config_key, config_value FROM risk_model_config`
  );
  const config = Object.fromEntries(
    (r.rows as { config_key: string; config_value: unknown }[]).map((x) => [x.config_key, x.config_value])
  );
  res.json(config);
});

// Dashboard KPIs
router.get('/dashboard', async (req, res) => {
  const userId = req.user?.id;
  const { status, agency, contract_type, risk_level } = req.query;
  let where = ' WHERE 1=1 ';
  const params: unknown[] = [];
  let i = 1;
  if (status) {
    where += ` AND s.status = $${i++}`;
    params.push(status);
  }
  if (agency) {
    where += ` AND s.agency ILIKE $${i++}`;
    params.push(`%${agency}%`);
  }
  if (contract_type) {
    where += ` AND s.contract_type = $${i++}`;
    params.push(contract_type);
  }
  if (risk_level) {
    where += ` AND s.overall_risk_level = $${i++}`;
    params.push(parseInt(risk_level as string));
  }

  const list = await query(
    `SELECT s.*, u.name as owner_name
     FROM solicitations s
     LEFT JOIN users u ON s.owner_id = u.id
     ${where}
     ORDER BY s.updated_at DESC`,
    params
  );
  const rows = list.rows as Record<string, unknown>[];

  const openDrafts = rows.filter((r) => r.status === 'DRAFT').length;
  const awaitingApproval = rows.filter((r) => r.status === 'AWAITING_APPROVALS').length;
  const escalations = rows.filter((r) => r.escalation_required).length;
  const finalized = rows.filter(
    (r) => r.status === 'FINALIZED' && r.finalized_at && new Date(r.finalized_at as string) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;
  const highRisk = rows.filter((r) => [3, 4].includes((r.overall_risk_level as number) ?? 0)).length;
  const avgRisk =
    rows.length > 0
      ? rows.reduce((s, r) => s + ((r.overall_risk_score as number) ?? 0), 0) / rows.length
      : 0;

  const myQueue = rows.filter((r) => r.owner_id === userId || r.status === 'DRAFT');
  const riskDist = { 1: 0, 2: 0, 3: 0, 4: 0 };
  rows.forEach((r) => {
    const l = (r.overall_risk_level as number) ?? 1;
    if (l >= 1 && l <= 4) riskDist[l as 1 | 2 | 3 | 4]++;
  });

  res.json({
    cards: { openDrafts, awaitingApproval, escalations, finalized, highRisk, avgRisk: Math.round(avgRisk * 10) / 10 },
    riskDistribution: riskDist,
    myWorkQueue: myQueue.slice(0, 10),
    recentlyFinalized: rows.filter((r) => r.status === 'FINALIZED').slice(0, 5)
  });
});

// List solicitations
router.get('/solicitations', async (req, res) => {
  const { status, agency, risk_level } = req.query;
  let sql = `SELECT s.*, u.name as owner_name FROM solicitations s LEFT JOIN users u ON s.owner_id = u.id WHERE 1=1`;
  const params: unknown[] = [];
  let i = 1;
  if (status) {
    sql += ` AND s.status = $${i++}`;
    params.push(status);
  }
  if (agency) {
    sql += ` AND s.agency ILIKE $${i++}`;
    params.push(`%${agency}%`);
  }
  if (risk_level) {
    sql += ` AND s.overall_risk_level = $${i++}`;
    params.push(parseInt(risk_level as string));
  }
  sql += ' ORDER BY s.updated_at DESC';
  const r = await query(sql, params);
  res.json(r.rows);
});

// Create solicitation
router.post(
  '/solicitations',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const body = z
      .object({
        solicitation_number: z.string().min(1),
        title: z.string().min(1),
        agency: z.string().min(1),
        naics_code: z.string().optional(),
        contract_type: z.enum(CONTRACT_TYPES as unknown as [string, ...string[]]),
        est_value: z.number().optional(),
        cui_involved: z.boolean().optional(),
        cmmc_level: z.string().optional(),
        set_aside_type: z.string().optional(),
        due_date: z.string().optional()
      })
      .parse(req.body);
    const userId = req.user?.id;

    const r = await query(
      `INSERT INTO solicitations (solicitation_number, title, agency, naics_code, contract_type, est_value, cui_involved, cmmc_level, set_aside_type, due_date, owner_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'DRAFT')
       RETURNING *`,
      [
        body.solicitation_number,
        body.title,
        body.agency,
        body.naics_code ?? null,
        body.contract_type,
        body.est_value ?? null,
        body.cui_involved ?? false,
        body.cmmc_level ?? 'None',
        body.set_aside_type ?? null,
        body.due_date ?? null,
        userId
      ]
    );
    const sol = r.rows[0] as { id: string };
    await query(
      `INSERT INTO solicitation_versions (solicitation_id, version) VALUES ($1, 1)`,
      [sol.id]
    );
    const ver = await query(
      `SELECT id FROM solicitation_versions WHERE solicitation_id = $1 AND version = 1`,
      [sol.id]
    );
    await logAudit('Solicitation', sol.id, 'created', userId);
    res.status(201).json(r.rows[0]);
  }
);

// Get solicitation by ID
router.get('/solicitations/:id', async (req, res) => {
  const { id } = req.params;
  const r = await query(
    `SELECT s.*, u.name as owner_name FROM solicitations s LEFT JOIN users u ON s.owner_id = u.id WHERE s.id = $1`,
    [id]
  );
  const sol = r.rows[0];
  if (!sol) return res.status(404).json({ error: 'Not found' });
  const versions = await query(
    `SELECT * FROM solicitation_versions WHERE solicitation_id = $1 ORDER BY version`,
    [id]
  );
  const currentVer = (sol as { current_version: number }).current_version ?? 1;
  const verId = (versions.rows.find((v) => (v as { version: number }).version === currentVer) as { id: string })?.id;
  const clauses = verId
    ? await query(
        `SELECT * FROM clause_review_entries WHERE version_id = $1 ORDER BY created_at`,
        [verId]
      )
    : { rows: [] };
  const approvals = await query(`SELECT * FROM approvals WHERE solicitation_id = $1`, [id]);
  res.json({
    ...sol,
    clause_entries: clauses.rows,
    approvals: approvals.rows,
    versions: versions.rows
  });
});

// Update solicitation
router.put(
  '/solicitations/:id',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const solR = await query(`SELECT * FROM solicitations WHERE id = $1`, [id]);
    const sol = solR.rows[0] as { status: string; owner_id: string } | undefined;
    if (!sol) return res.status(404).json({ error: 'Not found' });
    if (sol.status === 'FINALIZED') return res.status(403).json({ error: 'Cannot edit finalized solicitation' });
    if (!canEdit(req.user?.role ?? '', sol.owner_id, req.user?.id ?? '')) {
      return res.status(403).json({ error: 'Not authorized to edit' });
    }
    const body = req.body;
    const allowed = [
      'title', 'agency', 'naics_code', 'contract_type', 'est_value', 'cui_involved',
      'cmmc_level', 'set_aside_type', 'due_date', 'no_clauses_attestation'
    ];
    const updates: string[] = [];
    const values: unknown[] = [id];
    let i = 2;
    for (const k of allowed) {
      if (body[k] !== undefined) {
        updates.push(`${k} = $${i++}`);
        values.push(body[k]);
      }
    }
    if (body.no_clauses_attestation === true) {
      updates.push(`no_clauses_attested_by = $${i++}`, `no_clauses_attested_at = NOW()`);
      values.push(req.user?.id);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()');
    const r = await query(
      `UPDATE solicitations SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    await logAudit('Solicitation', id, 'updated', req.user?.id);
    res.json(r.rows[0]);
  }
);

// Add clause entry
router.post(
  '/solicitations/:id/clauses',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [id])).rows[0] as { status: string; current_version: number; owner_id: string } | undefined;
    if (!sol || sol.status === 'FINALIZED') return res.status(404).json({ error: 'Not found' });
    if (!canEdit(req.user?.role ?? '', sol.owner_id, req.user?.id ?? '')) return res.status(403).json({ error: 'Forbidden' });
    const ver = (await query(`SELECT id FROM solicitation_versions WHERE solicitation_id = $1 AND version = $2`, [id, sol.current_version])).rows[0] as { id: string };
    if (!ver) return res.status(500).json({ error: 'Version not found' });

    const body = z
      .object({
        clause_number: z.string(),
        clause_title: z.string().optional(),
        category: z.string().optional(),
        financial_dim: z.number().min(1).max(5).optional(),
        cyber_dim: z.number().min(1).max(5).optional(),
        liability_dim: z.number().min(1).max(5).optional(),
        regulatory_dim: z.number().min(1).max(5).optional(),
        performance_dim: z.number().min(1).max(5).optional(),
        not_applicable: z.boolean().optional(),
        not_applicable_reason: z.string().optional(),
        notes: z.string().optional()
      })
      .parse(req.body);

    const strictCheck = await validateClauseForStrictMode(body.clause_number);
    if (!strictCheck.ok) return res.status(400).json({ error: strictCheck.error });

    const fin = body.financial_dim ?? 2;
    const cyber = body.cyber_dim ?? 2;
    const liab = body.liability_dim ?? 2;
    const reg = body.regulatory_dim ?? 2;
    const perf = body.performance_dim ?? 2;
    const totalScore = computeClauseScore(fin, cyber, liab, reg, perf);
    const riskLevel = scoreToRiskLevel(totalScore);
    const has7012 = (body.clause_number as string).includes('7012');
    const esc = checkClauseEscalation(riskLevel, body.category ?? null, has7012);

    const r = await query(
      `INSERT INTO clause_review_entries (solicitation_id, version_id, clause_number, clause_title, category, financial_dim, cyber_dim, liability_dim, regulatory_dim, performance_dim, total_score, risk_level, escalation_trigger, escalation_reason, not_applicable, not_applicable_reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        id,
        ver.id,
        body.clause_number,
        body.clause_title ?? null,
        body.category ?? null,
        fin,
        cyber,
        liab,
        reg,
        perf,
        totalScore,
        riskLevel,
        esc.escalation,
        esc.reason ?? null,
        body.not_applicable ?? false,
        body.not_applicable_reason ?? null,
        body.notes ?? null
      ]
    );
    await recomputeSolicitationRisk(id);
    await logAudit('ClauseEntry', (r.rows[0] as { id: string }).id, 'created', req.user?.id);
    res.status(201).json(r.rows[0]);
  }
);

// Bulk add clauses
router.post(
  '/solicitations/:id/clauses/bulk',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const { clauses } = z.object({ clauses: z.array(z.string()) }).parse(req.body);
    const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [id])).rows[0] as { status: string; current_version: number; owner_id: string } | undefined;
    if (!sol || sol.status === 'FINALIZED') return res.status(404).json({ error: 'Not found' });
    if (!canEdit(req.user?.role ?? '', sol.owner_id, req.user?.id ?? '')) return res.status(403).json({ error: 'Forbidden' });
    const ver = (await query(`SELECT id FROM solicitation_versions WHERE solicitation_id = $1 AND version = $2`, [id, sol.current_version])).rows[0] as { id: string };
    if (!ver) return res.status(500).json({ error: 'Version not found' });

    const added = [];
    for (const cn of clauses) {
      const trimmed = cn.trim();
      if (!trimmed) continue;
      const strictCheck = await validateClauseForStrictMode(trimmed);
      if (!strictCheck.ok) {
        return res.status(400).json({ error: strictCheck.error });
      }
      const totalScore = computeClauseScore(2, 2, 2, 2, 2);
      const riskLevel = scoreToRiskLevel(totalScore);
      const has7012 = trimmed.includes('7012');
      const esc = checkClauseEscalation(riskLevel, null, has7012);
      const r = await query(
        `INSERT INTO clause_review_entries (solicitation_id, version_id, clause_number, financial_dim, cyber_dim, liability_dim, regulatory_dim, performance_dim, total_score, risk_level, escalation_trigger, escalation_reason)
         VALUES ($1, $2, $3, 2, 2, 2, 2, 2, $4, $5, $6, $7)
         RETURNING *`,
        [id, ver.id, trimmed, totalScore, riskLevel, esc.escalation, esc.reason ?? null]
      );
      added.push(r.rows[0]);
    }
    await recomputeSolicitationRisk(id);
    res.status(201).json(added);
  }
);

// Update clause entry
router.put(
  '/solicitations/:id/clauses/:clauseId',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id, clauseId } = req.params;
    const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [id])).rows[0] as { status: string; owner_id: string } | undefined;
    if (!sol || sol.status === 'FINALIZED') return res.status(404).json({ error: 'Not found' });
    if (!canEdit(req.user?.role ?? '', sol.owner_id, req.user?.id ?? '')) return res.status(403).json({ error: 'Forbidden' });
    const body = req.body;
    const dims = ['financial_dim', 'cyber_dim', 'liability_dim', 'regulatory_dim', 'performance_dim'];
    const updates: string[] = [];
    const values: unknown[] = [clauseId];
    let i = 2;
    for (const k of ['clause_title', 'category', ...dims, 'not_applicable', 'not_applicable_reason', 'notes']) {
      if (body[k] !== undefined) {
        updates.push(`${k} = $${i++}`);
        values.push(body[k]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const entry = (await query(`SELECT * FROM clause_review_entries WHERE id = $1 AND solicitation_id = $2`, [clauseId, id])).rows[0] as Record<string, unknown>;
    if (!entry) return res.status(404).json({ error: 'Not found' });
    const fin = (body.financial_dim ?? entry.financial_dim ?? 2) as number;
    const cyber = (body.cyber_dim ?? entry.cyber_dim ?? 2) as number;
    const liab = (body.liability_dim ?? entry.liability_dim ?? 2) as number;
    const reg = (body.regulatory_dim ?? entry.regulatory_dim ?? 2) as number;
    const perf = (body.performance_dim ?? entry.performance_dim ?? 2) as number;
    const totalScore = computeClauseScore(fin, cyber, liab, reg, perf);
    const riskLevel = scoreToRiskLevel(totalScore);
    const has7012 = String(entry.clause_number).includes('7012');
    const esc = checkClauseEscalation(riskLevel, (body.category ?? entry.category) as string, has7012);
    updates.push('total_score = $' + i++, 'risk_level = $' + i++, 'escalation_trigger = $' + i++, 'escalation_reason = $' + i++, 'updated_at = NOW()');
    values.push(totalScore, riskLevel, esc.escalation, esc.reason ?? null);
    const r = await query(
      `UPDATE clause_review_entries SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    await recomputeSolicitationRisk(id);
    res.json(r.rows[0]);
  }
);

async function recomputeSolicitationRisk(solId: string) {
  const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [solId])).rows[0] as Record<string, unknown>;
  if (!sol) return;
  const ver = (await query(`SELECT id FROM solicitation_versions WHERE solicitation_id = $1 AND version = $2`, [solId, sol.current_version])).rows[0] as { id: string };
  if (!ver) return;
  const clauses = (await query(`SELECT * FROM clause_review_entries WHERE version_id = $1`, [ver.id])).rows as Record<string, unknown>[];
  const l3 = clauses.filter((c) => c.risk_level === 3).length;
  const l4 = clauses.filter((c) => c.risk_level === 4).length;
  const { overallScore, overallLevel } = computeSolicitationRisk(
    clauses.map((c) => ({ total_score: c.total_score as number, risk_level: c.risk_level as number })),
    l3,
    l4
  );
  const has7012 = clauses.some((c) => String(c.clause_number).includes('7012'));
  const hasIndemnL3 = clauses.some((c) => c.category === 'Indemnification' && (c.risk_level as number) >= 3);
  const hasAudit = clauses.some((c) => c.category === 'Audit/Records');
  const esc = checkSolicitationEscalations({
    overallRiskLevel: overallLevel,
    contractType: sol.contract_type as string,
    cuiInvolved: sol.cui_involved as boolean,
    hasDfars7012: has7012,
    hasIndemnificationL3: hasIndemnL3,
    hasAuditClause: hasAudit,
    l4Count: l4,
    l3Count: l3
  });
  await query(
    `UPDATE solicitations SET overall_risk_score = $2, overall_risk_level = $3, escalation_required = $4, executive_approval_required = $5, quality_approval_required = $6, financial_review_required = $7, cyber_review_required = $8, updated_at = NOW() WHERE id = $1`,
    [
      solId,
      overallScore,
      overallLevel,
      esc.escalationRequired,
      esc.executiveApprovalRequired,
      esc.qualityApprovalRequired,
      esc.financialReviewRequired,
      esc.cyberReviewRequired
    ]
  );
}

// Submit for approvals
router.post(
  '/solicitations/:id/submit',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [id])).rows[0] as Record<string, unknown>;
    if (!sol || sol.status !== 'DRAFT') return res.status(400).json({ error: 'Invalid state' });
    if (!canEdit(req.user?.role ?? '', sol.owner_id as string, req.user?.id ?? '')) return res.status(403).json({ error: 'Forbidden' });

    const ver = (await query(`SELECT id FROM solicitation_versions WHERE solicitation_id = $1 AND version = $2`, [id, sol.current_version])).rows[0] as { id: string };
    const clauses = (await query(`SELECT * FROM clause_review_entries WHERE version_id = $1`, [ver.id])).rows;
    const hasClauses = clauses.length > 0 || sol.no_clauses_attestation === true;
    if (!hasClauses) return res.status(400).json({ error: 'Must add at least one clause or attest no clauses' });

    await query(`UPDATE solicitations SET status = 'AWAITING_APPROVALS', updated_at = NOW() WHERE id = $1`, [id]);
    const approvalTypes: string[] = [];
    if (sol.executive_approval_required) approvalTypes.push('Executive');
    if (sol.quality_approval_required) approvalTypes.push('Quality');
    if (sol.financial_review_required) approvalTypes.push('Financial');
    if (sol.cyber_review_required) approvalTypes.push('Cyber');
    if (approvalTypes.length === 0) approvalTypes.push('Quality');
    for (const t of approvalTypes) {
      await query(
        `INSERT INTO approvals (solicitation_id, approval_type, status) VALUES ($1, $2, 'Pending')`,
        [id, t]
      );
    }
    await logAudit('Solicitation', id, 'submitted', req.user?.id);
    res.json({ ok: true });
  }
);

// Record approval
router.post(
  '/solicitations/:id/approve',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  async (req, res) => {
    const { id } = req.params;
    const { approval_type, status, comment } = z.object({ approval_type: z.string(), status: z.enum(['Approved', 'Rejected']), comment: z.string().optional() }).parse(req.body);
    if (!canApprove(req.user?.role ?? '')) return res.status(403).json({ error: 'Forbidden' });
    await query(
      `UPDATE approvals SET status = $2, approver_id = $3, approved_at = NOW(), comment = $4, updated_at = NOW() WHERE solicitation_id = $1 AND approval_type = $5`,
      [id, status, req.user?.id, comment ?? null, approval_type]
    );
    if (status === 'Rejected') {
      await query(`UPDATE solicitations SET status = 'DRAFT', updated_at = NOW() WHERE id = $1`, [id]);
    }
    await logAudit('Solicitation', id, `approval_${status.toLowerCase()}`, req.user?.id, approval_type);
    res.json({ ok: true });
  }
);

// Finalize
router.post(
  '/solicitations/:id/finalize',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  async (req, res) => {
    const { id } = req.params;
    const sol = (await query(`SELECT * FROM solicitations WHERE id = $1`, [id])).rows[0] as Record<string, unknown>;
    if (!sol || sol.status !== 'AWAITING_APPROVALS') return res.status(400).json({ error: 'Must be awaiting approvals' });
    if (!canFinalize(req.user?.role ?? '')) return res.status(403).json({ error: 'Forbidden' });
    const approvs = (await query(`SELECT * FROM approvals WHERE solicitation_id = $1`, [id])).rows as Record<string, unknown>[];
    const pending = approvs.filter((a) => a.status === 'Pending');
    const rejected = approvs.filter((a) => a.status === 'Rejected');
    if (rejected.length > 0) return res.status(400).json({ error: 'Cannot finalize with rejected approvals' });
    if (pending.length > 0) return res.status(400).json({ error: 'All required approvals must be completed' });
    await query(`UPDATE solicitations SET status = 'FINALIZED', finalized_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    await logAudit('Solicitation', id, 'finalized', req.user?.id);
    res.json({ ok: true });
  }
);

// Audit trail
router.get('/solicitations/:id/audit', async (req, res) => {
  const { id } = req.params;
  const r = await query(
    `SELECT g.*, u.email as actor_email FROM governance_audit_events g
     LEFT JOIN users u ON g.actor_id = u.id
     WHERE (g.entity_type = 'Solicitation' AND g.entity_id = $1)
        OR (g.entity_type = 'ClauseEntry' AND g.entity_id IN (SELECT id FROM clause_review_entries WHERE solicitation_id = $1))
     ORDER BY g.created_at DESC`,
    [id]
  );
  res.json(r.rows);
});

// Clause library
router.get('/clause-library', async (req, res) => {
  const { search } = req.query;
  let sql = `SELECT * FROM clause_library_items WHERE active = true`;
  const params: unknown[] = [];
  if (search) {
    sql += ` AND (clause_number ILIKE $1 OR title ILIKE $1)`;
    params.push(`%${search}%`);
  }
  sql += ' ORDER BY clause_number';
  const r = await query(sql, params);
  res.json(r.rows);
});

router.post(
  '/clause-library',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  async (req, res) => {
    const body = z.object({ clause_number: z.string(), title: z.string(), category: z.string().optional(), notes: z.string().optional() }).parse(req.body);
    const r = await query(
      `INSERT INTO clause_library_items (clause_number, title, category, notes) VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.clause_number, body.title, body.category ?? null, body.notes ?? null]
    );
    res.status(201).json(r.rows[0]);
  }
);

// Reports
router.get('/reports', async (_req, res) => {
  const r = await query(
    `SELECT status, overall_risk_level, COUNT(*) as count FROM solicitations GROUP BY status, overall_risk_level`
  );
  res.json(r.rows);
});

// Constants for frontend
router.get('/constants', (_req, res) => {
  res.json({ categories: CLAUSE_CATEGORIES, contractTypes: CONTRACT_TYPES });
});

// Governance Completeness Index (maturity)
router.get('/maturity', async (req, res) => {
  try {
    const result = await computeGovernanceIndex();
    const storeSnapshot = req.query.store === 'true' || req.query.store === '1';
    if (storeSnapshot) {
      try {
        await query(
          `INSERT INTO governance_metric_snapshots (overall_score, pillar_contract, pillar_financial, pillar_cyber, pillar_insurance, pillar_structural, pillar_audit, pillar_documentation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            result.overallScore,
            result.pillarContract,
            result.pillarFinancial,
            result.pillarCyber,
            result.pillarInsurance,
            result.pillarStructural,
            result.pillarAudit,
            result.pillarDocumentation
          ]
        );
      } catch (e) {
        console.warn('Snapshot store failed (table may not exist):', e);
      }
    }
    res.json(result);
  } catch (err) {
    console.error('Maturity compute error:', err);
    res.status(500).json({ error: 'Failed to compute maturity index' });
  }
});

// Auto-Builder
router.get('/auto-builder/context', async (_req, res) => {
  try {
    const ctx = await loadAutoBuilderContext();
    const sectionEvals = SECTION_REGISTRY.map((s) => ({
      ...s,
      eval: s.maturityEvaluator(ctx),
      improveLinks: getImproveLinks(s.id)
    }));
    const dci = sectionEvals.length > 0
      ? sectionEvals.reduce((acc, s) => acc + s.eval.score0to1, 0) / sectionEvals.length * 100
      : 0;
    const weakest = [...sectionEvals].sort((a, b) => a.eval.score0to1 - b.eval.score0to1).slice(0, 10);
    res.json({
      context: ctx,
      sectionEvals,
      dci: Math.round(dci),
      weakest,
      disconnectIndicators: ctx.maturity.disconnectIndicators
    });
  } catch (err) {
    console.error('Auto-builder context error:', err);
    res.status(500).json({ error: 'Failed to load context' });
  }
});

router.get('/auto-builder/manual', async (_req, res) => {
  try {
    const ctx = await loadAutoBuilderContext();
    const markdown = generateManualMarkdown(ctx);
    res.json({ markdown });
  } catch (err) {
    console.error('Manual generation error:', err);
    res.status(500).json({ error: 'Failed to generate manual' });
  }
});

router.get('/auto-builder/evidence', async (_req, res) => {
  try {
    const ctx = await loadAutoBuilderContext();
    const markdown = generateEvidenceMarkdown(ctx);
    res.json({ markdown });
  } catch (err) {
    console.error('Evidence generation error:', err);
    res.status(500).json({ error: 'Failed to generate evidence packet' });
  }
});

router.get('/auto-builder/appendices', async (_req, res) => {
  try {
    const ctx = await loadAutoBuilderContext();
    const appendices = APPENDIX_LIST.map((title, i) => {
      const letter = String.fromCharCode(65 + i);
      let content = `*Placeholder for ${title}.* `;
      let maturity = 'PLANNED';
      if (title.includes('Clause') && title.includes('Library')) {
        content = `Clause library has ${ctx.clauseLibraryStats.total} items. `;
        maturity = ctx.clauseLibraryStats.total > 0 ? 'MANUAL' : 'PLANNED';
      } else if (title.includes('Flow-Down')) {
        content = `Flow-down clauses: ${JSON.stringify(ctx.clauseLibraryStats.flowDownCounts)}. `;
        maturity = 'MANUAL';
      } else if (title.includes('Governance KPI')) {
        content = `GCI: ${ctx.maturity.overallScore}%. Pillars: Contract ${ctx.maturity.pillarContract}, Financial ${ctx.maturity.pillarFinancial}, etc. `;
        maturity = 'AUTOMATED';
      }
      return { id: letter, title, content, maturity };
    });
    res.json({ appendices });
  } catch (err) {
    console.error('Appendices error:', err);
    res.status(500).json({ error: 'Failed to load appendices' });
  }
});

export default router;
