import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { seedClauseLibraryStarter } from '../db/seeds/05_clause_library_starter.js';
import { searchClauses, getClauseWithOverlay } from '../services/clauseService.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const CLAUSE_TYPES = ['FAR', 'DFARS', 'AGENCY', 'OTHER'] as const;
const CATEGORIES = [
  'TERMINATION', 'CHANGES', 'AUDIT_RECORDS', 'CYBER_CUI', 'INSURANCE', 'INDEMNIFICATION',
  'LABOR', 'SMALL_BUSINESS', 'PROPERTY', 'IP_DATA_RIGHTS', 'OCI_ETHICS', 'TRADE_COMPLIANCE',
  'FUNDING_PAYMENT', 'OTHER'
] as const;
const FLOW_DOWN = ['YES', 'NO', 'CONDITIONAL'] as const;

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
  ).catch((err) => console.error('Clause library audit failed:', err));
}

function normalizeClauseNumber(num: string): string {
  return num.replace(/^(FAR|DFARS)\s*/i, '').replace(/\s+/g, '').trim();
}

// GET /library - List with filters (canonical: regulatory_clauses + overlay via clauseService)
router.get('/library', async (req, res) => {
  const { type, category, flow_down, active, search, regulation, risk_level } = req.query;
  const queryStr = (search && typeof search === 'string') ? search : '';
  const filters: { regulationType?: 'FAR' | 'DFARS'; riskScore?: number; category?: string; flowDown?: string; active?: boolean } = {};
  const reg = (type || regulation) as string;
  if (reg && reg !== 'All' && (reg === 'FAR' || reg === 'DFARS')) filters.regulationType = reg;
  if (category && typeof category === 'string') filters.category = category;
  if (flow_down && typeof flow_down === 'string') filters.flowDown = flow_down;
  if (active !== undefined && active !== '') filters.active = active === 'true' || active === '1';
  if (risk_level && typeof risk_level === 'string') {
    const rl = parseInt(risk_level, 10);
    if (!isNaN(rl)) filters.riskScore = rl;
  }
  const rows = await searchClauses(queryStr, filters, 500);
  res.json(rows);
});

// GET /library/search?q=&limit= - Typeahead (canonical via clauseService)
router.get('/library/search', async (req, res) => {
  const { q, limit } = req.query;
  const search = (q as string)?.trim() ?? '';
  const lim = Math.min(parseInt((limit as string) ?? '10', 10), 25);
  const rows = await searchClauses(search, { active: true }, lim);
  res.json(rows);
});

// GET /library/by-number/:number - Get clause by number (canonical via clauseService)
router.get('/library/by-number/:number', async (req, res) => {
  const clause = await getClauseWithOverlay(req.params.number);
  if (!clause) return res.status(404).json({ error: 'Clause not found' });
  res.json(clause);
});

// POST /library/seed - Starter Pack Seed (SysAdmin/Quality only)
router.post(
  '/library/seed',
  authorize(['Level 1', 'Level 3']),
  async (req, res) => {
    try {
      const count = await seedClauseLibraryStarter();
      await logAudit('ClauseLibrary', 'seed', 'starter_pack_run', req.user?.id, undefined, undefined, String(count));
      res.json({ ok: true, count });
    } catch (err) {
      console.error('Starter pack seed failed:', err);
      res.status(500).json({ error: 'Seed failed' });
    }
  }
);

// POST /library - Add clause (SysAdmin/Quality only)
router.post(
  '/library',
  authorize(['Level 1', 'Level 3']),
  async (req, res) => {
    try {
    const body = z
      .object({
        clause_number: z.string().min(1),
        title: z.string().min(1),
        type: z.enum(CLAUSE_TYPES).optional(),
        category: z.enum(CATEGORIES).optional(),
        default_financial: z.number().min(1).max(5).optional(),
        default_cyber: z.number().min(1).max(5).optional(),
        default_liability: z.number().min(1).max(5).optional(),
        default_regulatory: z.number().min(1).max(5).optional(),
        default_performance: z.number().min(1).max(5).optional(),
        suggested_risk_level: z.number().min(1).max(4).optional(),
        flow_down: z.enum(FLOW_DOWN).optional(),
        flow_down_notes: z.string().optional(),
        notes: z.string().optional(),
        active: z.boolean().optional()
      })
      .parse(req.body);

    const clauseNumber = normalizeClauseNumber(body.clause_number);
    const type = body.type ?? (clauseNumber.startsWith('252.') ? 'DFARS' : clauseNumber.startsWith('52.') ? 'FAR' : 'OTHER');

    const result = await query(
      `INSERT INTO clause_library_items (
        clause_number, title, type, category,
        default_financial, default_cyber, default_liability, default_regulatory, default_performance,
        suggested_risk_level, flow_down, flow_down_notes, notes, active, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        clauseNumber,
        body.title,
        type,
        body.category ?? null,
        body.default_financial ?? 2,
        body.default_cyber ?? 2,
        body.default_liability ?? 2,
        body.default_regulatory ?? 2,
        body.default_performance ?? 2,
        body.suggested_risk_level ?? null,
        body.flow_down ?? 'CONDITIONAL',
        body.flow_down_notes ?? null,
        body.notes ?? null,
        body.active ?? true,
        req.user?.id
      ]
    );
    const row = result.rows[0] as { id: string };
    await logAudit('ClauseLibraryItem', row.id, 'created', req.user?.id);
    res.status(201).json(row);
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === '23505') {
        return res.status(409).json({ error: 'Clause number already exists' });
      }
      throw err;
    }
  }
);

// PUT /library/:id - Edit clause (SysAdmin/Quality only)
router.put(
  '/library/:id',
  authorize(['Level 1', 'Level 3']),
  async (req, res) => {
    const { id } = req.params;
    const existing = (await query('SELECT * FROM clause_library_items WHERE id = $1', [id])).rows[0] as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Clause not found' });

    const body = req.body;
    const allowed = [
      'title', 'type', 'category',
      'default_financial', 'default_cyber', 'default_liability', 'default_regulatory', 'default_performance',
      'suggested_risk_level', 'flow_down', 'flow_down_notes', 'notes', 'active'
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
    if (body.clause_number !== undefined) {
      updates.push(`clause_number = $${i++}`);
      values.push(normalizeClauseNumber(body.clause_number));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()', `updated_by = $${i++}`);
    values.push(req.user?.id);

    const result = await query(
      `UPDATE clause_library_items SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    await logAudit('ClauseLibraryItem', id, 'updated', req.user?.id);
    res.json(result.rows[0]);
  }
);

// GET /library/:id - Get single clause
router.get('/library/:id', async (req, res) => {
  const clause = await getClauseWithOverlay(req.params.id);
  if (!clause) return res.status(404).json({ error: 'Clause not found' });
  res.json(clause);
});

// GET /library/constants - Enums for frontend
router.get('/library/constants', (_req, res) => {
  res.json({ types: CLAUSE_TYPES, categories: CATEGORIES, flowDown: FLOW_DOWN });
});

export default router;
