import { query } from '../connection.js';

export async function seedGovernanceEngine() {
  await query(
    `INSERT INTO risk_model_config (config_key, config_value) VALUES
      ('weights', '{"financial": 1.2, "cyber": 1.5, "liability": 1.3, "regulatory": 1.0, "performance": 1.0}'::jsonb),
      ('thresholds', '{"l1_max": 10, "l2_max": 18, "l3_max": 25, "l4_min": 26}'::jsonb)
    ON CONFLICT (config_key) DO NOTHING`
  );

  const clauses = [
    { clause_number: '252.204-7012', title: 'Safeguarding Covered Defense Information', category: 'CYBER_CUI', cyber: 5 },
    { clause_number: '252.204-7021', title: 'CMMC Requirements', category: 'CYBER_CUI', cyber: 5 },
    { clause_number: '52.215-2', title: 'Audit and Records', category: 'AUDIT_RECORDS', financial: 4 },
    { clause_number: '52.232-7', title: 'Payments Under Time-and-Materials', category: 'FUNDING_PAYMENT', financial: 3 },
    { clause_number: '52.232-20', title: 'Limitation of Cost', category: 'FUNDING_PAYMENT', financial: 4 },
    { clause_number: '52.249-2', title: 'Termination for Convenience', category: 'TERMINATION', financial: 4, liability: 4 },
    { clause_number: '52.243-1', title: 'Changes - Fixed-Price', category: 'CHANGES', financial: 3 },
    { clause_number: '52.219-14', title: 'Limitations on Subcontracting', category: 'SMALL_BUSINESS', regulatory: 3 },
    { clause_number: '52.222-41', title: 'Service Contract Labor Standards', category: 'LABOR', regulatory: 3 },
    { clause_number: '52.242-15', title: 'Stop-Work Order', category: 'CHANGES', performance: 3 }
  ];

  for (const c of clauses) {
    await query(
      `INSERT INTO clause_library_items (clause_number, title, category, default_financial, default_cyber, default_liability, default_regulatory, default_performance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (clause_number) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category`,
      [
        c.clause_number,
        c.title,
        c.category,
        (c as { financial?: number }).financial ?? 2,
        (c as { cyber?: number }).cyber ?? 2,
        (c as { liability?: number }).liability ?? 2,
        2,
        2
      ]
    );
  }
  console.log('✅ Seeded risk model config and clause library');
}
