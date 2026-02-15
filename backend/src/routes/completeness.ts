/**
 * GET /api/completeness/org - Organization-wide governance completeness
 */
import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/org', async (_req, res) => {
  const sols = (await query(
    `SELECT id FROM solicitations WHERE status NOT IN ('ARCHIVED', 'REJECTED_NO_BID')`
  )).rows as { id: string }[];
  let totalPct = 0;
  for (const s of sols) {
    const c = (await query(
      `SELECT COUNT(*) as total,
        (SELECT COUNT(*) FROM clause_risk_assessments cra
         JOIN solicitation_clauses sc ON cra.solicitation_clause_id = sc.id
         WHERE sc.solicitation_id = $1 AND cra.status = 'APPROVED') as approved
       FROM solicitation_clauses WHERE solicitation_id = $1`,
      [s.id]
    )).rows[0] as { total: string; approved: string };
    const t = parseInt(c.total, 10);
    if (t > 0) totalPct += (parseInt(c.approved, 10) / t) * 100;
  }
  const avg = sols.length > 0 ? Math.round(totalPct / sols.length) : 0;
  res.json({ percentComplete: avg, solicitationCount: sols.length });
});

export default router;
