import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

// Library routes moved to clauseLibrary.ts (clause_library_items)

router.get('/contracts/:contractId/clauses', async (req, res) => {
  const { contractId } = req.params;
  const result = await query(
    `SELECT cc.id, cc.clause_number, cc.title, cc.regulation, cc.risk_level, cc.risk_category,
            ccl.compliance_status, ccl.notes, ccl.last_reviewed_at, ccl.id as link_id
     FROM compliance_clauses cc
     LEFT JOIN contract_clauses ccl ON cc.id = ccl.clause_id AND ccl.contract_id = $1
     ORDER BY cc.risk_level DESC NULLS LAST, cc.clause_number ASC`,
    [contractId]
  );
  res.json(result.rows);
});

router.post(
  '/contracts/:contractId/clauses',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('ContractClause', 'CREATE'),
  async (req, res) => {
    const { contractId } = req.params;
    const { clause_id } = z.object({ clause_id: z.string().uuid() }).parse(req.body);
    const result = await query(
      `INSERT INTO contract_clauses (contract_id, clause_id)
       VALUES ($1, $2)
       ON CONFLICT (contract_id, clause_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [contractId, clause_id]
    );
    res.status(201).json(result.rows[0]);
  }
);

router.put(
  '/contracts/:contractId/clauses/:linkId',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('ContractClause', 'UPDATE'),
  async (req, res) => {
    const { contractId, linkId } = req.params;
    const { compliance_status, notes } = req.body;
    const result = await query(
      `UPDATE contract_clauses
       SET compliance_status = COALESCE($3, compliance_status),
           notes = COALESCE($4, notes),
           last_reviewed_at = NOW(),
           reviewed_by = $5,
           updated_at = NOW()
       WHERE id = $1 AND contract_id = $2
       RETURNING *`,
      [linkId, contractId, compliance_status, notes, req.user?.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    res.json(result.rows[0]);
  }
);

export default router;
