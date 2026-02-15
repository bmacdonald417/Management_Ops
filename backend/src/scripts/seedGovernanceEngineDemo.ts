#!/usr/bin/env node
/**
 * Seed a demo solicitation for Governance Engine acceptance testing.
 * Run: npm run seed:engine-demo (or tsx src/scripts/seedGovernanceEngineDemo.ts)
 *
 * Creates one solicitation, extracts sample clauses, assesses them, generates snapshot.
 * Use with a dev token (Level 1) to complete Approve to Bid.
 */
import { query } from '../db/connection.js';
import { extractClausesFromText } from '../services/clauseExtractor.js';

const SAMPLE_TEXT = `
This solicitation includes the following clauses:
52.249-2 Termination for Convenience
252.204-7012 Safeguarding Covered Defense Information
52.215-2 Audit and Records
52.232-20 Limitation of Cost
52.219-14 Limitations on Subcontracting
`;

async function main() {
  const users = (await query(`SELECT id, role FROM users ORDER BY created_at LIMIT 1`)).rows as { id: string; role: string }[];
  const userId = users[0]?.id;
  if (!userId) {
    console.error('No user found. Run app and create a user first.');
    process.exit(1);
  }

  const sol = (await query(
    `INSERT INTO solicitations (
      solicitation_number, title, agency, contract_type, owner_id, created_by_user_id, status
    ) VALUES ($1, $2, $3, $4, $5, $6, 'CLAUSE_EXTRACTION_PENDING')
    RETURNING id, solicitation_number`,
    ['DEMO-ENGINE-001', 'Governance Engine Demo Solicitation', 'DoD', 'FFP', userId, userId]
  )).rows[0] as { id: string; solicitation_number: string };

  console.log('Created solicitation:', sol.solicitation_number, sol.id);

  const extracted = extractClausesFromText(SAMPLE_TEXT);
  for (const e of extracted) {
    const clauseRow = (await query(
      `SELECT id, flow_down_required FROM regulatory_clauses WHERE clause_number = $1`,
      [e.clauseNumber]
    )).rows[0] as { id: string; flow_down_required: boolean } | undefined;
    if (!clauseRow) continue;
    try {
      await query(
        `INSERT INTO solicitation_clauses (solicitation_id, clause_id, detected_from, detected_confidence, is_flow_down_required)
         VALUES ($1, $2, 'PASTED_TEXT', 0.9, $3)
         ON CONFLICT (solicitation_id, clause_id) DO NOTHING`,
        [sol.id, clauseRow.id, clauseRow.flow_down_required]
      );
    } catch {
      // skip dup
    }
  }
  const added = (await query(`SELECT COUNT(*) as c FROM solicitation_clauses WHERE solicitation_id = $1`, [sol.id])).rows[0]?.c ?? 0;
  await query(`UPDATE solicitations SET status = 'CLAUSE_EXTRACTION_COMPLETE', updated_at = NOW() WHERE id = $1`, [sol.id]);
  console.log('Extracted', extracted.length, 'clauses, added', added, 'to solicitation');

  const scRows = (await query(
    `SELECT sc.id, rc.clause_number FROM solicitation_clauses sc
     JOIN regulatory_clauses rc ON sc.clause_id = rc.id WHERE sc.solicitation_id = $1`,
    [sol.id]
  )).rows as { id: string; clause_number: string }[];

  for (const sc of scRows) {
    let riskLevel = 'L2';
    let score = 30;
    if (sc.clause_number.includes('7012') || sc.clause_number.includes('7021')) {
      riskLevel = 'L3';
      score = 55;
    } else if (sc.clause_number.includes('249-2')) {
      riskLevel = 'L3';
      score = 52;
    }
    const approvalTier = riskLevel === 'L3' || riskLevel === 'L4' ? 'QUALITY' : 'NONE';
    const status = approvalTier === 'NONE' ? 'APPROVED' : 'SUBMITTED';
    await query(
      `INSERT INTO clause_risk_assessments (
        solicitation_clause_id, risk_level, risk_score_percent, risk_category,
        rationale, requires_flow_down, approval_tier_required, status,
        assessed_by_user_id, assessed_at, approved_by_user_id, approved_at, version
      ) VALUES ($1, $2, $3, 'Other', 'Demo seed', true, $4, $5, $6, NOW(), $7, $8, 1)`,
      [sc.id, riskLevel, score, approvalTier, status, userId, status === 'APPROVED' ? userId : null, status === 'APPROVED' ? new Date() : null]
    );
  }
  console.log('Assessed', scRows.length, 'clauses');

  const l3l4 = scRows.filter((_r, i) => [0, 1].includes(i)).length;
  await query(
    `INSERT INTO clause_risk_log_snapshots (
      solicitation_id, generated_by_user_id, overall_risk_level, overall_risk_score_percent,
      open_findings_count, high_risk_clause_count, json_payload
    ) VALUES ($1, $2, 'L3', 55, 0, $3, $4)`,
    [sol.id, userId, l3l4, JSON.stringify({ clauses: scRows.map((r) => r.clause_number), generatedAt: new Date().toISOString() })]
  );
  console.log('Generated Clause Risk Log snapshot');

  console.log('\n=== Demo Ready ===');
  console.log('Solicitation ID:', sol.id);
  console.log('Navigate to: /governance-engine/solicitations/' + sol.id + '/engine');
  console.log('L3 clauses need Quality approval. Use Level 1/2/3 user to approve, then Approve to Bid.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
