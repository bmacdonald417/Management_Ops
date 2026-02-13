import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/kpis', async (_req, res) => {
  const contracts = await query(
    `SELECT status, COUNT(*) as count FROM contracts WHERE deleted_at IS NULL GROUP BY status`
  );
  const statusCounts = Object.fromEntries((contracts.rows as { status: string; count: string }[]).map((r) => [r.status, parseInt(r.count, 10)]));

  const riskDist = await query(
    `SELECT rp.overall_risk_level, COUNT(*) as count
     FROM risk_profiles rp
     JOIN contracts c ON c.risk_profile_id = rp.id AND c.deleted_at IS NULL
     WHERE rp.overall_risk_level IS NOT NULL
     GROUP BY rp.overall_risk_level`
  );
  const riskDistribution = Object.fromEntries(
    (riskDist.rows as { overall_risk_level: number; count: string }[]).map((r) => [r.overall_risk_level, parseInt(r.count, 10)])
  );

  const openCompliance = await query(
    `SELECT COUNT(*) as count FROM contract_clauses WHERE compliance_status IN ('Not Started', 'In Progress')`
  );
  const openTasks = parseInt((openCompliance.rows[0] as { count?: string })?.count ?? '0', 10);

  const incidents = await query(
    `SELECT COUNT(*) as count FROM incident_reports WHERE status IN ('Investigating', 'Reported')`
  );
  const activeIncidents = parseInt((incidents.rows[0] as { count?: string })?.count ?? '0', 10);

  res.json({
    contracts: {
      active: statusCounts['Active'] ?? 0,
      opportunities: statusCounts['Opportunity'] ?? 0,
      preBid: statusCounts['Pre-Bid'] ?? 0,
      awarded: statusCounts['Awarded'] ?? 0,
      closed: statusCounts['Closed'] ?? 0,
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0)
    },
    riskDistribution: { 1: riskDistribution[1] ?? 0, 2: riskDistribution[2] ?? 0, 3: riskDistribution[3] ?? 0, 4: riskDistribution[4] ?? 0 },
    openComplianceTasks: openTasks,
    activeCyberIncidents: activeIncidents,
    pendingApprovals: 0
  });
});

export default router;
