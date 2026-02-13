import { query } from '../connection.js';
import { v4 as uuidv4 } from 'uuid';

export async function seedDevData() {
  const userId = uuidv4();
  await query(
    `INSERT INTO users (id, auth_id, email, name, role)
     VALUES ($1, 'dev-auth-1', 'admin@mactech.local', 'Dev Admin', 'Level 1')
     ON CONFLICT (auth_id) DO NOTHING`,
    [userId]
  );

  const contractId = uuidv4();
  await query(
    `INSERT INTO contracts (id, title, contract_number, agency, naics_code, contract_type, status, total_contract_value, funded_amount, period_of_performance_start, period_of_performance_end)
     VALUES ($1, 'Sample DoD IT Support Contract', 'MACTECH-2025-001', 'Department of Defense', '541512', 'FFP', 'Pre-Bid', 2500000, 500000, '2025-03-01', '2026-02-28')
     ON CONFLICT DO NOTHING`,
    [contractId]
  );

  const riskProfileId = uuidv4();
  await query(
    `INSERT INTO risk_profiles (id, contract_id, overall_risk_level, strategic_risk_level, financial_risk_level, cyber_risk_level, status)
     VALUES ($1, $2, 3, 3, 2, 4, 'Submitted')`,
    [riskProfileId, contractId]
  );

  await query(`UPDATE contracts SET risk_profile_id = $1 WHERE id = $2`, [riskProfileId, contractId]);

  await query(
    `INSERT INTO indirect_rates (rate_type, rate_value, effective_date, quarter)
     VALUES ('Fringe', 0.35, '2025-01-01', 'Q1 2025'),
            ('Overhead', 0.45, '2025-01-01', 'Q1 2025'),
            ('G&A', 0.12, '2025-01-01', 'Q1 2025')`
  );

  console.log('✅ Seeded dev user, sample contract, risk profile, and indirect rates');
}
