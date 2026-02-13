import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

router.get('/profiles/:id', async (req, res) => {
  const { id } = req.params;
  const result = await query('SELECT * FROM risk_profiles WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Risk profile not found' });
  res.json(result.rows[0]);
});

router.post(
  '/profiles',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('RiskProfile', 'CREATE'),
  async (req, res) => {
    const body = z
      .object({
        contract_id: z.string().uuid(),
        strategic_risk_level: z.number().min(1).max(4).optional(),
        financial_risk_level: z.number().min(1).max(4).optional(),
        regulatory_risk_level: z.number().min(1).max(4).optional(),
        cyber_risk_level: z.number().min(1).max(4).optional(),
        operational_risk_level: z.number().min(1).max(4).optional(),
        reputational_risk_level: z.number().min(1).max(4).optional(),
        overall_risk_level: z.number().min(1).max(4).optional(),
        status: z.string().optional()
      })
      .parse(req.body);
    const levels = body;
    const overall = body.overall_risk_level ?? 2;
    const result = await query(
      `INSERT INTO risk_profiles (contract_id, strategic_risk_level, financial_risk_level,
        regulatory_risk_level, cyber_risk_level, operational_risk_level, reputational_risk_level,
        overall_risk_level, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        body.contract_id,
        levels.strategic_risk_level ?? 2,
        levels.financial_risk_level ?? 2,
        levels.regulatory_risk_level ?? 2,
        levels.cyber_risk_level ?? 2,
        levels.operational_risk_level ?? 2,
        levels.reputational_risk_level ?? 2,
        overall,
        body.status ?? 'Draft'
      ]
    );
    const profile = result.rows[0] as { id: string };
    await query(
      'UPDATE contracts SET risk_profile_id = $1, updated_at = NOW() WHERE id = $2',
      [profile.id, body.contract_id]
    );
    res.status(201).json(result.rows[0]);
  }
);

router.put(
  '/profiles/:id',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('RiskProfile', 'UPDATE'),
  async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const allowed = [
      'strategic_risk_level', 'financial_risk_level', 'regulatory_risk_level',
      'cyber_risk_level', 'operational_risk_level', 'reputational_risk_level',
      'overall_risk_level', 'status'
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
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const result = await query(
      `UPDATE risk_profiles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Risk profile not found' });
    res.json(result.rows[0]);
  }
);

router.post(
  '/escalations',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('RiskEscalation', 'CREATE'),
  async (req, res) => {
    const body = z
      .object({
        risk_profile_id: z.string().uuid(),
        description: z.string(),
        escalation_level: z.number().min(1).max(4)
      })
      .parse(req.body);
    const result = await query(
      `INSERT INTO risk_escalations (risk_profile_id, description, escalation_level, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.risk_profile_id, body.description, body.escalation_level, req.user?.id]
    );
    res.status(201).json(result.rows[0]);
  }
);

export default router;
