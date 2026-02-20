/**
 * Phase 3: Completeness Index & Doctrine Builder API.
 */
import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createDoctrine,
  getDoctrine,
  updateDoctrine,
  createSection,
  updateSection,
  deleteSection,
  markSectionComplete,
  getCompletenessIndex,
  getDoctrineContextForSuggestions
} from '../services/governanceDoctrineService.js';
import { getDoctrineSectionSuggestions } from '../services/doctrineSectionSuggestions.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

function logAudit(entityType: string, entityId: string, action: string, actorId?: string, meta?: Record<string, unknown>) {
  return query(
    `INSERT INTO governance_audit_events (entity_type, entity_id, action, field_name, old_value, new_value, actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [entityType, entityId, action, meta ? 'metadata' : null, null, meta ? JSON.stringify(meta) : null, actorId]
  ).catch((e) => console.error('Doctrine audit failed:', e));
}

// POST /api/governance-doctrine
router.post(
  '/',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const body = z.object({
      title: z.string().min(1),
      version: z.string().optional(),
      purpose: z.string().optional()
    }).parse(req.body);
    const doc = await createDoctrine(body.title, body.version ?? '1.0', body.purpose);
    await logAudit('GovernanceDoctrine', doc.id, 'created', req.user?.id);
    res.status(201).json(doc);
  }
);

// GET /api/governance-doctrine (list)
router.get('/', async (_req, res) => {
  const r = await query(
    `SELECT * FROM governance_doctrine ORDER BY updated_at DESC`
  );
  res.json(r.rows);
});

// GET /api/governance-doctrine/:id
router.get('/:id', async (req, res) => {
  const doc = await getDoctrine(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

// PUT /api/governance-doctrine/:id
router.put(
  '/:id',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const body = req.body as { title?: string; version?: string; purpose?: string };
    const doc = await updateDoctrine(req.params.id, body);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await logAudit('GovernanceDoctrine', req.params.id, 'updated', req.user?.id);
    res.json(doc);
  }
);

// GET /api/governance-doctrine/:id/completeness
router.get('/:id/completeness', async (req, res) => {
  const exists = (await query(`SELECT 1 FROM governance_doctrine WHERE id = $1`, [req.params.id])).rows[0];
  if (!exists) return res.status(404).json({ error: 'Not found' });
  const index = await getCompletenessIndex(req.params.id);
  res.json(index);
});

// POST /api/governance-doctrine/:id/sections
router.post(
  '/:id/sections',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const body = z.object({
      sectionNumber: z.string().min(1),
      title: z.string().min(1),
      content: z.string().optional(),
      order: z.number().int().min(0).optional(),
      required: z.boolean().optional()
    }).parse(req.body);

    const doctrine = await getDoctrine(id);
    if (!doctrine) return res.status(404).json({ error: 'Doctrine not found' });

    const order = body.order ?? doctrine.sections.length;
    const section = await createSection(
      id,
      body.sectionNumber,
      body.title,
      body.content ?? '',
      order,
      body.required ?? true
    );
    if (!section) return res.status(400).json({ error: 'Section not created (duplicate section number?)' });
    await logAudit('DoctrineSection', section.id, 'created', req.user?.id);
    res.status(201).json(section);
  }
);

// POST /api/governance-doctrine/sections/:sectionId/suggestions
router.post(
  '/sections/:sectionId/suggestions',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { sectionId } = req.params;
    const section = (await query(
      `SELECT ds.*, gd.title AS doctrine_title FROM doctrine_sections ds
       JOIN governance_doctrine gd ON ds.governance_doctrine_id = gd.id WHERE ds.id = $1`,
      [sectionId]
    )).rows[0] as { doctrine_title: string; title: string; content: string | null; governance_doctrine_id: string } | undefined;
    if (!section) return res.status(404).json({ error: 'Section not found' });

    const fullDoctrineContext = await getDoctrineContextForSuggestions(section.governance_doctrine_id);
    const suggestions = await getDoctrineSectionSuggestions({
      doctrineTitle: section.doctrine_title,
      sectionTitle: section.title,
      existingContent: section.content ?? undefined,
      fullDoctrineContext: fullDoctrineContext || undefined
    });

    const saveToSection = (req.query.save as string) === 'true';
    if (saveToSection && suggestions.length > 0) {
      await updateSection(sectionId, { copilotSuggestions: suggestions });
    }

    res.json({ suggestions });
  }
);

// PUT /api/governance-doctrine/sections/:sectionId
router.put(
  '/sections/:sectionId',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { sectionId } = req.params;
    const body = req.body as { title?: string; content?: string; order?: number; required?: boolean; copilotSuggestions?: unknown };
    const section = await updateSection(sectionId, {
      title: body.title,
      content: body.content,
      order: body.order,
      required: body.required,
      copilotSuggestions: body.copilotSuggestions
    });
    if (!section) return res.status(404).json({ error: 'Not found' });
    res.json(section);
  }
);

// DELETE /api/governance-doctrine/sections/:sectionId
router.delete(
  '/sections/:sectionId',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { sectionId } = req.params;
    const exists = (await query(`SELECT 1 FROM doctrine_sections WHERE id = $1`, [sectionId])).rows[0];
    if (!exists) return res.status(404).json({ error: 'Not found' });
    await deleteSection(sectionId);
    await logAudit('DoctrineSection', sectionId, 'deleted', req.user?.id);
    res.status(204).send();
  }
);

// POST /api/governance-doctrine/sections/:sectionId/complete
router.post(
  '/sections/:sectionId/complete',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { sectionId } = req.params;
    const body = (req.body || {}) as { notes?: string };
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const exists = (await query(`SELECT 1 FROM doctrine_sections WHERE id = $1`, [sectionId])).rows[0];
    if (!exists) return res.status(404).json({ error: 'Not found' });
    const completeness = await markSectionComplete(sectionId, userId, body.notes);
    res.json(completeness);
  }
);

export default router;
