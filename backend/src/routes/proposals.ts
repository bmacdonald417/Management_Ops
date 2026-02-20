/**
 * Phase 2: Proposal & Governance Automation Engine.
 * CRUD for proposals, sections, forms; document generation.
 */
import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateProposalDocument } from '../services/proposalGeneratorService.js';
import { getProposalSectionSuggestions, getSolicitationDetailsForProposal } from '../services/proposalSectionSuggestions.js';
import { fillForm } from '../services/formFillingService.js';
import {
  isQmsConfigured,
  qmsGetFormTemplate,
  qmsUploadCompletedForm,
  qmsDownloadDocument
} from '../services/qmsClient.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const PROPOSAL_STATUSES = ['DRAFT', 'IN_REVIEW', 'SUBMITTED', 'AWARDED', 'ARCHIVED'] as const;
const PROPOSAL_TYPES = ['RFP', 'SOW', 'Solicitation'] as const;
const FORM_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED'] as const;

function logAudit(entityType: string, entityId: string, action: string, actorId?: string, meta?: Record<string, unknown>) {
  return query(
    `INSERT INTO governance_audit_events (entity_type, entity_id, action, field_name, old_value, new_value, actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [entityType, entityId, action, meta ? 'metadata' : null, null, meta ? JSON.stringify(meta) : null, actorId]
  ).catch((e) => console.error('Proposal audit failed:', e));
}

// POST /api/proposals
router.post(
  '/',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const body = z.object({
      title: z.string().min(1),
      proposalType: z.enum(PROPOSAL_TYPES).optional(),
      solicitationId: z.string().uuid().optional()
    }).parse(req.body);

    const r = await query(
      `INSERT INTO proposals (title, proposal_type, solicitation_id, created_by_id, status)
       VALUES ($1, $2, $3, $4, 'DRAFT') RETURNING *`,
      [
        body.title,
        body.proposalType ?? 'Solicitation',
        body.solicitationId ?? null,
        req.user?.id
      ]
    );
    const row = r.rows[0] as { id: string };
    await logAudit('Proposal', row.id, 'created', req.user?.id, { title: body.title });
    res.status(201).json(row);
  }
);

// GET /api/proposals
router.get('/', async (req, res) => {
  const { status, solicitationId, page, limit } = req.query;
  let sql = `SELECT p.*, s.title as solicitation_title, s.solicitation_number
             FROM proposals p LEFT JOIN solicitations s ON p.solicitation_id = s.id WHERE 1=1`;
  const params: unknown[] = [];
  let i = 1;
  if (status && typeof status === 'string') {
    sql += ` AND p.status = $${i++}`;
    params.push(status);
  }
  if (solicitationId && typeof solicitationId === 'string') {
    sql += ` AND p.solicitation_id = $${i++}`;
    params.push(solicitationId);
  }
  sql += ` ORDER BY p.updated_at DESC, p.created_at DESC`;
  const lim = Math.min(Math.max(parseInt((limit as string) || '50', 10), 1), 100);
  const off = Math.max(parseInt((page as string) || '0', 10), 0) * lim;
  sql += ` LIMIT $${i} OFFSET $${i + 1}`;
  params.push(lim, off);

  const r = await query(sql, params);
  res.json(r.rows);
});

// GET /api/proposals/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const prop = (await query(
    `SELECT p.*, s.title as solicitation_title, s.solicitation_number FROM proposals p
     LEFT JOIN solicitations s ON p.solicitation_id = s.id WHERE p.id = $1`,
    [id]
  )).rows[0];
  if (!prop) return res.status(404).json({ error: 'Not found' });

  const sections = (await query(
    `SELECT * FROM proposal_sections WHERE proposal_id = $1 ORDER BY "order" ASC, created_at ASC`,
    [id]
  )).rows;
  const forms = (await query(
    `SELECT * FROM proposal_forms WHERE proposal_id = $1 ORDER BY created_at ASC`,
    [id]
  )).rows;

  res.json({ ...prop, sections, forms });
});

// PUT /api/proposals/:id
router.put(
  '/:id',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.title !== undefined) { updates.push(`title = $${i++}`); values.push(body.title); }
    if (body.status !== undefined && PROPOSAL_STATUSES.includes(body.status as (typeof PROPOSAL_STATUSES)[number])) { updates.push(`status = $${i++}`); values.push(body.status); }
    if (body.proposalType !== undefined && PROPOSAL_TYPES.includes(body.proposalType as (typeof PROPOSAL_TYPES)[number])) { updates.push(`proposal_type = $${i++}`); values.push(body.proposalType); }
    if (body.submissionDeadline !== undefined) { updates.push(`submission_deadline = $${i++}`); values.push(body.submissionDeadline || null); }
    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const r = await query(
      `UPDATE proposals SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    await logAudit('Proposal', id, 'updated', req.user?.id);
    res.json(r.rows[0]);
  }
);

// DELETE /api/proposals/:id
router.delete(
  '/:id',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const r = await query(`DELETE FROM proposals WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    await logAudit('Proposal', id, 'deleted', req.user?.id);
    res.status(204).send();
  }
);

// POST /api/proposals/:id/sections
router.post(
  '/:id/sections',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const body = z.object({
      title: z.string().min(1),
      content: z.string().optional(),
      order: z.number().int().min(0).optional()
    }).parse(req.body);

    const exists = (await query(`SELECT 1 FROM proposals WHERE id = $1`, [id])).rows[0];
    if (!exists) return res.status(404).json({ error: 'Proposal not found' });

    const orderResult = (await query(`SELECT COALESCE(MAX("order"), -1) + 1 AS n FROM proposal_sections WHERE proposal_id = $1`, [id])).rows[0] as { n: number } | undefined;
    const order = body.order ?? orderResult?.n ?? 0;
    const r = await query(
      `INSERT INTO proposal_sections (proposal_id, title, content, "order")
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, body.title, body.content ?? null, order]
    );
    const row = r.rows[0] as { id: string };
    await logAudit('ProposalSection', row.id, 'created', req.user?.id);
    res.status(201).json(row);
  }
);

// POST /api/proposals/sections/:sectionId/suggestions — Copilot suggestions for section content
router.post(
  '/sections/:sectionId/suggestions',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { sectionId } = req.params;
    const section = (await query(
      `SELECT ps.*, p.id AS proposal_id FROM proposal_sections ps JOIN proposals p ON ps.proposal_id = p.id WHERE ps.id = $1`,
      [sectionId]
    )).rows[0] as { proposal_id: string; title: string; content: string | null } | undefined;
    if (!section) return res.status(404).json({ error: 'Section not found' });

    const solicitationDetails = await getSolicitationDetailsForProposal(section.proposal_id);
    const body = (req.body || {}) as { qmsDoctrineSections?: string[] };
    const suggestions = await getProposalSectionSuggestions({
      solicitationDetails,
      sectionTitle: section.title,
      existingContent: section.content ?? undefined,
      qmsDoctrineSections: body.qmsDoctrineSections
    });

    const saveToSection = (req.query.save as string) === 'true';
    if (saveToSection && suggestions.length > 0) {
      await query(
        `UPDATE proposal_sections SET copilot_suggestions = $2::jsonb, updated_at = NOW() WHERE id = $1`,
        [sectionId, JSON.stringify(suggestions)]
      );
    }

    res.json({ suggestions });
  }
);

// PUT /api/proposals/sections/:sectionId
router.put(
  '/sections/:sectionId',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { sectionId } = req.params;
    const body = req.body as Record<string, unknown>;
    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.title !== undefined) { updates.push(`title = $${i++}`); values.push(body.title); }
    if (body.content !== undefined) { updates.push(`content = $${i++}`); values.push(body.content); }
    if (typeof body.order === 'number') { updates.push(`"order" = $${i++}`); values.push(body.order); }
    if (body.copilotSuggestions !== undefined) { updates.push(`copilot_suggestions = $${i++}::jsonb`); values.push(JSON.stringify(body.copilotSuggestions)); }
    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    updates.push(`updated_at = NOW()`);
    values.push(sectionId);

    const r = await query(
      `UPDATE proposal_sections SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  }
);

// DELETE /api/proposals/sections/:sectionId
router.delete(
  '/sections/:sectionId',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { sectionId } = req.params;
    const r = await query(`DELETE FROM proposal_sections WHERE id = $1 RETURNING id`, [sectionId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  }
);

// Helper: fill template and upload to QMS; returns { completedQmsDocumentId, downloadUrl } or null
async function fillAndUploadForm(proposalId: string, qmsDocumentId: string, formName: string, formData: Record<string, unknown>) {
  if (!isQmsConfigured()) return null;
  const template = await qmsGetFormTemplate(qmsDocumentId);
  if (!template) return null;
  const filledBuffer = await fillForm(template.templateBuffer, template.templateType, formData);
  const ext = template.templateType === 'pdf' ? 'pdf' : template.templateType === 'docx' ? 'docx' : 'html';
  const mime = template.templateType === 'pdf' ? 'application/pdf' : template.templateType === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/html';
  const result = await qmsUploadCompletedForm(filledBuffer, {
    originalQMSDocumentId: qmsDocumentId,
    proposalId,
    formName,
    fileName: `${formName.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`,
    mimeType: mime
  });
  return result;
}

// POST /api/proposals/:id/forms
router.post(
  '/:id/forms',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    const body = z.object({
      qmsDocumentId: z.string().min(1),
      formName: z.string().min(1),
      formData: z.record(z.unknown()).optional()
    }).parse(req.body);

    const exists = (await query(`SELECT 1 FROM proposals WHERE id = $1`, [id])).rows[0];
    if (!exists) return res.status(404).json({ error: 'Proposal not found' });

    const r = await query(
      `INSERT INTO proposal_forms (proposal_id, qms_document_id, form_name, form_data, status)
       VALUES ($1, $2, $3, $4::jsonb, 'PENDING') RETURNING *`,
      [id, body.qmsDocumentId, body.formName, JSON.stringify(body.formData ?? {})]
    );
    const row = r.rows[0] as { id: string };

    if (Object.keys(body.formData ?? {}).length > 0 && isQmsConfigured()) {
      try {
        const result = await fillAndUploadForm(id, body.qmsDocumentId, body.formName, body.formData as Record<string, unknown>);
        if (result) {
          await query(
            `UPDATE proposal_forms SET completed_qms_document_id = $2, download_url = $3, status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
            [row.id, result.qmsDocumentId, result.downloadUrl || null]
          );
          const updated = (await query(`SELECT * FROM proposal_forms WHERE id = $1`, [row.id])).rows[0];
          return res.status(201).json(updated);
        }
      } catch (e) {
        console.error('Form fill/upload failed:', e);
      }
    }

    res.status(201).json(row);
  }
);

// PUT /api/proposals/forms/:formId
router.put(
  '/forms/:formId',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { formId } = req.params;
    const body = req.body as Record<string, unknown>;
    const formRow = (await query(
      `SELECT id, proposal_id, qms_document_id, form_name FROM proposal_forms WHERE id = $1`,
      [formId]
    )).rows[0] as { id: string; proposal_id: string; qms_document_id: string; form_name: string } | undefined;
    if (!formRow) return res.status(404).json({ error: 'Not found' });

    if (body.formData !== undefined && Object.keys(body.formData as Record<string, unknown>).length > 0 && isQmsConfigured()) {
      try {
        const result = await fillAndUploadForm(
          formRow.proposal_id,
          formRow.qms_document_id,
          formRow.form_name,
          body.formData as Record<string, unknown>
        );
        if (result) {
          body.completedQmsDocumentId = result.qmsDocumentId;
          body.downloadUrl = result.downloadUrl ?? null;
          body.status = 'COMPLETED';
        }
      } catch (e) {
        console.error('Form fill/upload failed:', e);
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.formData !== undefined) { updates.push(`form_data = $${i++}::jsonb`); values.push(JSON.stringify(body.formData)); }
    if (body.status !== undefined && FORM_STATUSES.includes(body.status as (typeof FORM_STATUSES)[number])) { updates.push(`status = $${i++}`); values.push(body.status); }
    if (body.completedQmsDocumentId !== undefined) { updates.push(`completed_qms_document_id = $${i++}`); values.push(body.completedQmsDocumentId); }
    if (body.downloadUrl !== undefined) { updates.push(`download_url = $${i++}`); values.push(body.downloadUrl); }
    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    updates.push(`updated_at = NOW()`);
    values.push(formId);

    const r = await query(
      `UPDATE proposal_forms SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  }
);

// GET /api/proposals/forms/:formId/download-completed
router.get(
  '/forms/:formId/download-completed',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { formId } = req.params;
    const form = (await query(
      `SELECT pf.id, pf.form_name, pf.completed_qms_document_id, pf.download_url, pf.proposal_id
       FROM proposal_forms pf WHERE pf.id = $1`,
      [formId]
    )).rows[0] as { id: string; form_name: string; completed_qms_document_id: string | null; download_url: string | null; proposal_id: string } | undefined;
    if (!form) return res.status(404).json({ error: 'Form not found' });
    if (!form.completed_qms_document_id && !form.download_url) {
      return res.status(400).json({ error: 'No completed form document available' });
    }
    if (form.download_url) {
      return res.redirect(form.download_url);
    }
    const buffer = await qmsDownloadDocument(form.completed_qms_document_id!);
    if (!buffer) return res.status(502).json({ error: 'Could not download document from QMS' });
    const filename = `${(form.form_name || 'form').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
);

// POST /api/proposals/:id/generate — returns generated document (HTML)
router.post(
  '/:id/generate',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const buffer = await generateProposalDocument(id);
      const proposal = (await query(`SELECT title FROM proposals WHERE id = $1`, [id])).rows[0] as { title: string } | undefined;
      const filename = (proposal?.title || 'proposal').replace(/[^a-zA-Z0-9_-]/g, '_') + '.html';
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (e) {
      const err = e as Error;
      if (err.message === 'Proposal not found') return res.status(404).json({ error: err.message });
      console.error('Proposal generate error:', err);
      res.status(500).json({ error: 'Document generation failed' });
    }
  }
);

export default router;
