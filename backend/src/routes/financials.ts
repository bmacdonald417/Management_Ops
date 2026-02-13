import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

router.get('/rates', async (req, res) => {
  const { rate_type, quarter } = req.query;
  let sql = 'SELECT * FROM indirect_rates WHERE 1=1';
  const params: unknown[] = [];
  let i = 1;
  if (rate_type) {
    sql += ` AND rate_type = $${i++}`;
    params.push(rate_type);
  }
  if (quarter) {
    sql += ` AND quarter = $${i++}`;
    params.push(quarter);
  }
  sql += ' ORDER BY effective_date DESC';
  const result = await query(sql, params);
  res.json(result.rows);
});

router.post(
  '/rates',
  authorize(['Level 1', 'Level 2']),
  auditLog('IndirectRate', 'CREATE'),
  async (req, res) => {
    const body = z
      .object({
        rate_type: z.string(),
        rate_value: z.number(),
        effective_date: z.string(),
        quarter: z.string().optional()
      })
      .parse(req.body);
    const result = await query(
      `INSERT INTO indirect_rates (rate_type, rate_value, effective_date, quarter)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.rate_type, body.rate_value, body.effective_date, body.quarter ?? null]
    );
    res.status(201).json(result.rows[0]);
  }
);

router.get('/contracts/:contractId/costs', async (req, res) => {
  const { contractId } = req.params;
  const { start_date, end_date } = req.query;
  let sql = 'SELECT * FROM job_cost_logs WHERE contract_id = $1';
  const params: unknown[] = [contractId];
  let i = 2;
  if (start_date) {
    sql += ` AND log_date >= $${i++}`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND log_date <= $${i++}`;
    params.push(end_date);
  }
  sql += ' ORDER BY log_date DESC';
  const result = await query(sql, params);
  res.json(result.rows);
});

router.post(
  '/contracts/:contractId/costs',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  auditLog('JobCostLog', 'CREATE'),
  async (req, res) => {
    const { contractId } = req.params;
    const body = z
      .object({
        direct_labor_cost: z.number().optional(),
        direct_material_cost: z.number().optional(),
        subcontractor_cost: z.number().optional(),
        other_direct_cost: z.number().optional(),
        fringe_burden: z.number().optional(),
        overhead_burden: z.number().optional(),
        ga_burden: z.number().optional(),
        log_date: z.string()
      })
      .parse(req.body);
    const dl = body.direct_labor_cost ?? 0;
    const dm = body.direct_material_cost ?? 0;
    const sc = body.subcontractor_cost ?? 0;
    const odc = body.other_direct_cost ?? 0;
    const fr = body.fringe_burden ?? 0;
    const oh = body.overhead_burden ?? 0;
    const ga = body.ga_burden ?? 0;
    const total = dl + dm + sc + odc + fr + oh + ga;
    const result = await query(
      `INSERT INTO job_cost_logs (contract_id, direct_labor_cost, direct_material_cost,
        subcontractor_cost, other_direct_cost, fringe_burden, overhead_burden, ga_burden, total_cost, log_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [contractId, dl, dm, sc, odc, fr, oh, ga, total, body.log_date]
    );
    res.status(201).json(result.rows[0]);
  }
);

export default router;
