import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

router.get('/cmmc/controls', async (req, res) => {
  const { domain, level } = req.query;
  let sql = 'SELECT * FROM cmmc_controls WHERE 1=1';
  const params: unknown[] = [];
  let i = 1;
  if (domain) {
    sql += ` AND domain = $${i++}`;
    params.push(domain);
  }
  if (level) {
    sql += ` AND level = $${i++}`;
    params.push(level);
  }
  sql += ' ORDER BY control_identifier ASC';
  const result = await query(sql, params);
  res.json(result.rows);
});

router.get('/contracts/:contractId/cmmc', async (req, res) => {
  const { contractId } = req.params;
  const result = await query(
    `SELECT cc.id as control_id, cc.control_identifier, cc.domain, cc.practice_statement, cc.objective,
            ca.implementation_status, ca.assessment_score, ca.evidence_description, ca.last_assessed_at
     FROM cmmc_controls cc
     LEFT JOIN cmmc_assessments ca ON cc.id = ca.control_id AND ca.contract_id = $1
     ORDER BY cc.domain ASC, cc.control_identifier ASC`,
    [contractId]
  );
  res.json(result.rows);
});

router.put(
  '/contracts/:contractId/cmmc/:controlId',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('CMMCAssessment', 'UPDATE'),
  async (req, res) => {
    const { contractId, controlId } = req.params;
    const body = z
      .object({
        implementation_status: z.string(),
        assessment_score: z.number().min(0).max(5).optional(),
        evidence_description: z.string().optional(),
        assessor_notes: z.string().optional()
      })
      .parse(req.body);
    const result = await query(
      `INSERT INTO cmmc_assessments (contract_id, control_id, implementation_status, assessment_score, evidence_description, assessor_notes, assessed_by, last_assessed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (contract_id, control_id) DO UPDATE SET
         implementation_status = EXCLUDED.implementation_status,
         assessment_score = EXCLUDED.assessment_score,
         evidence_description = EXCLUDED.evidence_description,
         assessor_notes = EXCLUDED.assessor_notes,
         assessed_by = EXCLUDED.assessed_by,
         last_assessed_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [
        contractId,
        controlId,
        body.implementation_status,
        body.assessment_score ?? null,
        body.evidence_description ?? null,
        body.assessor_notes ?? null,
        req.user?.id
      ]
    );
    res.json(result.rows[0]);
  }
);

router.get('/incidents', async (req, res) => {
  const { status, contract_id } = req.query;
  let sql = 'SELECT * FROM incident_reports WHERE 1=1';
  const params: unknown[] = [];
  let i = 1;
  if (status) {
    sql += ` AND status = $${i++}`;
    params.push(status);
  }
  if (contract_id) {
    sql += ` AND contract_id = $${i++}`;
    params.push(contract_id);
  }
  sql += ' ORDER BY created_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
});

router.post(
  '/incidents',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('IncidentReport', 'CREATE'),
  async (req, res) => {
    const body = z
      .object({
        contract_id: z.string().uuid().optional(),
        incident_level: z.number().min(1).max(4),
        description: z.string(),
        status: z.string().optional(),
        discovered_at: z.string().optional()
      })
      .parse(req.body);
    const result = await query(
      `INSERT INTO incident_reports (contract_id, incident_level, description, status, discovered_at, reported_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [
        body.contract_id ?? null,
        body.incident_level,
        body.description,
        body.status ?? 'Investigating',
        body.discovered_at ?? null
      ]
    );
    res.status(201).json(result.rows[0]);
  }
);

router.put(
  '/incidents/:id',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('IncidentReport', 'UPDATE'),
  async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const allowed = ['status', 'description', 'incident_level'];
    const updates: string[] = [];
    const values: unknown[] = [id];
    let i = 2;
    for (const k of allowed) {
      if (body[k] !== undefined) {
        updates.push(`${k} = $${i++}`);
        values.push(body[k]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const result = await query(
      `UPDATE incident_reports SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
    res.json(result.rows[0]);
  }
);

export default router;
