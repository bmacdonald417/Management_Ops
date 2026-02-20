import { Router, Response } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { CLAUSE_CATEGORIES, CONTRACT_TYPES } from '../services/governanceScoring.js';
import { searchClauses } from '../services/clauseService.js';
import { computeGovernanceIndex } from '../services/governanceMaturity.js';
import { loadAutoBuilderContext } from '../services/autoBuilder/context.js';
import { generateManualMarkdown, generateEvidenceMarkdown } from '../services/autoBuilder/generate.js';
import { SECTION_REGISTRY, APPENDIX_LIST } from '../services/autoBuilder/sectionRegistry.js';
import { getImproveLinks } from '../services/autoBuilder/maturityBridge.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

/** Legacy solicitation workflow deprecated; use /api/solicitations (engine). */
function legacyGone(res: Response) {
  res.status(410).json({ migrated: true, use: '/api/solicitations' });
}

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

// List solicitations (legacy deprecated — use GET /api/solicitations)
router.get('/solicitations', (_req, res) => legacyGone(res));

// Create solicitation (legacy deprecated — use POST /api/solicitations)
router.post('/solicitations', authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']), (_req, res) => legacyGone(res));

// Get solicitation by ID (legacy deprecated — use GET /api/solicitations/:id)
router.get('/solicitations/:id', (_req, res) => legacyGone(res));

// Update solicitation (legacy deprecated — use PATCH /api/solicitations/:id)
router.put('/solicitations/:id', authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']), (_req, res) => legacyGone(res));

// Add clause entry (legacy deprecated — use POST /api/solicitations/:id/clauses/extract or /manual)
router.post('/solicitations/:id/clauses', authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']), (_req, res) => legacyGone(res));

// Bulk add clauses (legacy deprecated — use POST /api/solicitations/:id/clauses/extract)
router.post('/solicitations/:id/clauses/bulk', authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']), (_req, res) => legacyGone(res));

// Update clause entry (legacy deprecated — use POST /api/solicitation-clauses/:id/assess)
router.put('/solicitations/:id/clauses/:clauseId', authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']), (_req, res) => legacyGone(res));

// Submit for approvals (legacy deprecated — use engine approve-to-bid flow)
router.post('/solicitations/:id/submit', authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']), (_req, res) => legacyGone(res));

// Record approval (legacy deprecated — use engine approval flow)
router.post('/solicitations/:id/approve', authorize(['Level 1', 'Level 2', 'Level 3']), (_req, res) => legacyGone(res));

// Finalize (legacy deprecated — use POST /api/solicitations/:id/approve-to-bid)
router.post('/solicitations/:id/finalize', authorize(['Level 1', 'Level 2', 'Level 3']), (_req, res) => legacyGone(res));

// Audit trail (legacy deprecated — use GET /api/solicitations/:id and engine audit)
router.get('/solicitations/:id/audit', (_req, res) => legacyGone(res));

// Clause library (canonical: regulatory_clauses + overlay via clauseService)
router.get('/clause-library', async (req, res) => {
  const { search } = req.query;
  const queryStr = (search && typeof search === 'string') ? search : '';
  const rows = await searchClauses(queryStr, { active: true }, 500);
  res.json(rows);
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
