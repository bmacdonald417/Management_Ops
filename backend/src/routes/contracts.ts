import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { z } from 'zod';

const router = Router();
const ContractSchema = z.object({
  title: z.string().min(1),
  contract_number: z.string().optional(),
  agency: z.string().optional(),
  naics_code: z.string().optional(),
  contract_type: z.string().optional(),
  period_of_performance_start: z.string().optional(),
  period_of_performance_end: z.string().optional(),
  total_contract_value: z.number().optional(),
  funded_amount: z.number().optional(),
  status: z.enum(['Opportunity', 'Pre-Bid', 'Awarded', 'Active', 'Closed']).optional()
});

router.use(authenticate);

router.get('/', async (req, res) => {
  const { status, agency, contract_type } = req.query;
  let sql = `SELECT c.*, rp.overall_risk_level
    FROM contracts c
    LEFT JOIN risk_profiles rp ON c.risk_profile_id = rp.id
    WHERE c.deleted_at IS NULL`;
  const params: unknown[] = [];
  let i = 1;
  if (status) {
    sql += ` AND c.status = $${i++}`;
    params.push(status);
  }
  if (agency) {
    sql += ` AND c.agency ILIKE $${i++}`;
    params.push(`%${agency}%`);
  }
  if (contract_type) {
    sql += ` AND c.contract_type = $${i++}`;
    params.push(contract_type);
  }
  sql += ' ORDER BY c.updated_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `SELECT c.*, rp.overall_risk_level, rp.status as risk_status
     FROM contracts c
     LEFT JOIN risk_profiles rp ON c.risk_profile_id = rp.id
     WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [id]
  );
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: 'Contract not found' });
  res.json(row);
});

router.post(
  '/',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  auditLog('Contract', 'CREATE'),
  async (req, res) => {
    const body = ContractSchema.parse(req.body);
    const result = await query(
      `INSERT INTO contracts (title, contract_number, agency, naics_code, contract_type,
        period_of_performance_start, period_of_performance_end, total_contract_value, funded_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        body.title,
        body.contract_number ?? null,
        body.agency ?? null,
        body.naics_code ?? null,
        body.contract_type ?? null,
        body.period_of_performance_start ?? null,
        body.period_of_performance_end ?? null,
        body.total_contract_value ?? 0,
        body.funded_amount ?? 0,
        body.status ?? 'Opportunity'
      ]
    );
    res.status(201).json(result.rows[0]);
  }
);

router.put(
  '/:id',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  auditLog('Contract', 'UPDATE'),
  async (req, res) => {
    const { id } = req.params;
    const body = ContractSchema.partial().parse(req.body);
    const keys = Object.keys(body) as (keyof typeof body)[];
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = keys.map((k) => body[k]);
    const result = await query(
      `UPDATE contracts SET ${setClause}, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, ...values]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json(result.rows[0]);
  }
);

router.delete(
  '/:id',
  authorize(['Level 1', 'Level 2']),
  auditLog('Contract', 'DELETE'),
  async (req, res) => {
    const { id } = req.params;
    await query(`UPDATE contracts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`, [id]);
    res.status(204).send();
  }
);

router.post(
  '/:id/phases',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('Contract', 'PHASE_CHANGE'),
  async (req, res) => {
    const { id } = req.params;
    const { phase } = z.object({ phase: z.string() }).parse(req.body);
    const validPhases = ['Opportunity', 'Pre-Bid', 'Awarded', 'Active', 'Closed'];
    if (!validPhases.includes(phase)) {
      return res.status(400).json({ error: 'Invalid phase', valid: validPhases });
    }
    const result = await query(
      `UPDATE contracts SET status = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, phase]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json(result.rows[0]);
  }
);

export default router;
