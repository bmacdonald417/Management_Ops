import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { seedClauseLibraryStarter } from '../db/seeds/05_clause_library_starter.js';
import {
  searchClauses,
  getClauseWithOverlay,
  getClauseByNumber,
  clauseExistsInRegulatory,
  normalizeClauseNumber,
  inferRegulationType,
  type RegulationType
} from '../services/clauseService.js';
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
  const regType = (req.query.regType as RegulationType) || undefined;
  const clause = await getClauseWithOverlay(req.params.number, regType);
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

// POST /library - DEPRECATED: Block new clause creation. Use POST /library/overrides for overlay.
router.post(
  '/library',
  authorize(['Level 1', 'Level 3']),
  async (req, res) => {
    const body = z.object({
      clause_number: z.string().min(1),
      regulation_type: z.enum(['FAR', 'DFARS']).optional()
    }).parse(req.body);
    const num = normalizeClauseNumber(body.clause_number);
    const regType = (body.regulation_type ?? inferRegulationType(num)) as RegulationType;
    const exists = await clauseExistsInRegulatory(regType, num);
    if (!exists) {
      return res.status(400).json({
        error: 'Cannot create brand-new clause. Clause must exist in Regulatory Library first.',
        hint: 'Ingest via Admin > Compliance Registry (reg:ingest), then add overlay via POST /api/compliance/library/overrides'
      });
    }
    return res.status(400).json({
      error: 'Use POST /api/compliance/library/overrides to add overlay for this clause.',
      hint: 'Clause exists in regulatory_clauses. Add overlay via POST /library/overrides'
    });
  }
);

// --- Overlay CRUD (Quality/SysAdmin only) ---

// POST /library/overrides - Create overlay for existing regulatory clause
router.post(
  '/library/overrides',
  authorize(['Level 1', 'Level 3']),
  async (req, res) => {
    const body = z.object({
      clause_number: z.string().min(1),
      regulation_type: z.enum(['FAR', 'DFARS']),
      override_risk_category: z.string().optional(),
      override_risk_score: z.number().min(1).max(100).optional(),
      override_flow_down_required: z.boolean().optional(),
      override_suggested_mitigation: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      flow_down_notes: z.string().optional()
    }).parse(req.body);

    const num = normalizeClauseNumber(body.clause_number);
    const exists = await clauseExistsInRegulatory(body.regulation_type, num);
    if (!exists) {
      return res.status(400).json({
        error: 'Clause must exist in regulatory_clauses. Ingest via Admin > Compliance Registry first.'
      });
    }

    const rc = (await query(
      `SELECT id, title FROM regulatory_clauses WHERE regulation_type = $1 AND clause_number = $2`,
      [body.regulation_type, num]
    )).rows[0] as { id: string; title: string };

    // Prefer unified_clause_master when present (Phase 1)
    const unified = (await query(
      `SELECT id FROM unified_clause_master WHERE regulation = $1 AND clause_number = $2`,
      [body.regulation_type, num]
    )).rows[0] as { id: string } | undefined;
    if (unified) {
      await query(
        `UPDATE unified_clause_master SET
          override_risk_category = $2, override_risk_score = $3, override_flow_down_required = $4,
          override_suggested_mitigation = $5, overlay_tags = $6::jsonb, overlay_notes = $7, flow_down_notes = $8,
          updated_by_id = $9, updated_at = NOW()
         WHERE id = $1`,
        [
          unified.id,
          body.override_risk_category ?? null,
          body.override_risk_score ?? null,
          body.override_flow_down_required ?? null,
          body.override_suggested_mitigation ?? null,
          JSON.stringify(body.tags ?? []),
          body.notes ?? null,
          body.flow_down_notes ?? null,
          req.user?.id
        ]
      );
      const merged = await getClauseByNumber(body.regulation_type, num);
      return res.status(201).json(merged);
    }

    const r = await query(
      `INSERT INTO clause_library_items (
        clause_number, regulation_type, title, type,
        override_risk_category, override_risk_score, override_flow_down_required,
        override_suggested_mitigation, tags, notes, flow_down_notes,
        active, updated_by, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, true, $12, NOW())
      ON CONFLICT (regulation_type, clause_number) DO UPDATE SET
        override_risk_category = EXCLUDED.override_risk_category,
        override_risk_score = EXCLUDED.override_risk_score,
        override_flow_down_required = EXCLUDED.override_flow_down_required,
        override_suggested_mitigation = EXCLUDED.override_suggested_mitigation,
        tags = EXCLUDED.tags,
        notes = EXCLUDED.notes,
        flow_down_notes = EXCLUDED.flow_down_notes,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING *`,
      [
        num,
        body.regulation_type,
        rc.title,
        body.regulation_type,
        body.override_risk_category ?? null,
        body.override_risk_score ?? null,
        body.override_flow_down_required ?? null,
        body.override_suggested_mitigation ?? null,
        JSON.stringify(body.tags ?? []),
        body.notes ?? null,
        body.flow_down_notes ?? null,
        req.user?.id
      ]
    );
    const row = r.rows[0];
    await logAudit('ClauseOverlay', (row as { id: string }).id, 'created', req.user?.id, 'clause_number', undefined, num);
    const merged = await getClauseByNumber(body.regulation_type, num);
    res.status(201).json(merged ?? row);
  }
);

// PUT /library/overrides/:id - Update overlay (unified_clause_master or clause_library_items)
router.put(
  '/library/overrides/:id',
  authorize(['Level 1', 'Level 3']),
  async (req, res) => {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // Prefer update on unified_clause_master when id is a unified row
    const unified = isUuid ? (await query('SELECT id, regulation, clause_number FROM unified_clause_master WHERE id = $1', [id])).rows[0] as { id: string; regulation: string; clause_number: string } | undefined : undefined;
    if (unified) {
      const body = req.body;
      const updates: string[] = [];
      const values: unknown[] = [unified.id];
      let i = 2;
      if (body.override_risk_category !== undefined) { updates.push(`override_risk_category = $${i++}`); values.push(body.override_risk_category); }
      if (body.override_risk_score !== undefined) { updates.push(`override_risk_score = $${i++}`); values.push(body.override_risk_score); }
      if (body.override_flow_down_required !== undefined) { updates.push(`override_flow_down_required = $${i++}`); values.push(body.override_flow_down_required); }
      if (body.override_suggested_mitigation !== undefined) { updates.push(`override_suggested_mitigation = $${i++}`); values.push(body.override_suggested_mitigation); }
      if (body.tags !== undefined) { updates.push(`overlay_tags = $${i++}::jsonb`); values.push(JSON.stringify(Array.isArray(body.tags) ? body.tags : [])); }
      if (body.notes !== undefined) { updates.push(`overlay_notes = $${i++}`); values.push(body.notes); }
      if (body.flow_down_notes !== undefined) { updates.push(`flow_down_notes = $${i++}`); values.push(body.flow_down_notes); }
      if (updates.length > 0) {
        updates.push('updated_at = NOW()', `updated_by_id = $${i++}`);
        values.push(req.user?.id);
        await query(`UPDATE unified_clause_master SET ${updates.join(', ')} WHERE id = $1`, values);
        await logAudit('ClauseOverlay', id, 'updated', req.user?.id);
      }
      const merged = await getClauseByNumber(unified.regulation as RegulationType, unified.clause_number);
      return res.json(merged);
    }

    const existing = (await query('SELECT * FROM clause_library_items WHERE id = $1', [id])).rows[0] as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Overlay not found' });

    const body = req.body;
    const allowed = [
      'override_risk_category', 'override_risk_score', 'override_flow_down_required',
      'override_suggested_mitigation', 'tags', 'notes', 'flow_down_notes'
    ];
    const updates: string[] = [];
    const values: unknown[] = [id];
    let i = 2;
    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (k === 'tags') {
          updates.push(`tags = $${i++}::jsonb`);
          values.push(JSON.stringify(Array.isArray(body[k]) ? body[k] : []));
        } else {
          updates.push(`${k} = $${i++}`);
          values.push(body[k]);
        }
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No overlay fields to update' });
    updates.push('updated_at = NOW()', `updated_by = $${i++}`);
    values.push(req.user?.id);

    await query(
      `UPDATE clause_library_items SET ${updates.join(', ')} WHERE id = $1`,
      values
    );
    await logAudit('ClauseOverlay', id, 'updated', req.user?.id);
    const regType = (existing.regulation_type ?? inferRegulationType(existing.clause_number as string)) as RegulationType;
    const merged = await getClauseByNumber(regType, existing.clause_number as string);
    res.json(merged);
  }
);

// GET /library/overrides/by-number/:clauseNumber?regType=FAR|DFARS
router.get('/library/overrides/by-number/:clauseNumber', async (req, res) => {
  const num = normalizeClauseNumber(req.params.clauseNumber);
  const regType = ((req.query.regType as string) || inferRegulationType(num)) as RegulationType;
  if (regType !== 'FAR' && regType !== 'DFARS') {
    return res.status(400).json({ error: 'regType must be FAR or DFARS' });
  }
  const clause = await getClauseByNumber(regType, num);
  if (!clause) return res.status(404).json({ error: 'Clause not found' });
  res.json(clause);
});

// PUT /library/:id - Edit overlay only (SysAdmin/Quality only)
router.put(
  '/library/:id',
  authorize(['Level 1', 'Level 3']),
  async (req, res) => {
    const { id } = req.params;
    const existing = (await query('SELECT * FROM clause_library_items WHERE id = $1', [id])).rows[0] as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Clause overlay not found' });

    const body = req.body;
    const overlayFields: { key: string; col: string; transform?: (v: unknown) => unknown }[] = [
      { key: 'override_risk_category', col: 'override_risk_category' },
      { key: 'category', col: 'override_risk_category' },
      { key: 'override_risk_score', col: 'override_risk_score' },
      { key: 'suggested_risk_level', col: 'override_risk_score' },
      { key: 'override_flow_down_required', col: 'override_flow_down_required', transform: (v) => v === 'YES' || v === true },
      { key: 'flow_down', col: 'override_flow_down_required', transform: (v) => v === 'YES' || v === true },
      { key: 'override_suggested_mitigation', col: 'override_suggested_mitigation' },
      { key: 'tags', col: 'tags', transform: (v) => JSON.stringify(Array.isArray(v) ? v : []) },
      { key: 'notes', col: 'notes' },
      { key: 'flow_down_notes', col: 'flow_down_notes' },
      { key: 'active', col: 'active' }
    ];
    const updates: string[] = [];
    const values: unknown[] = [id];
    let i = 2;
    const handled = new Set<string>();
    for (const { key, col, transform } of overlayFields) {
      if (body[key] === undefined || handled.has(col)) continue;
      handled.add(col);
      const val = transform ? transform(body[key]) : body[key];
      updates.push(`${col} = $${i++}${col === 'tags' ? '::jsonb' : ''}`);
      values.push(val);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No overlay fields to update' });
    updates.push('updated_at = NOW()', `updated_by = $${i++}`);
    values.push(req.user?.id);

    await query(`UPDATE clause_library_items SET ${updates.join(', ')} WHERE id = $1`, values);
    await logAudit('ClauseOverlay', id, 'updated', req.user?.id);
    const regType = (existing.regulation_type ?? inferRegulationType(existing.clause_number as string)) as RegulationType;
    const merged = await getClauseByNumber(regType, existing.clause_number as string);
    res.json(merged);
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
