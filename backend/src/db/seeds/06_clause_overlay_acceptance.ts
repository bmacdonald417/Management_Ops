/**
 * Acceptance seed: Overlay for DFARS 252.204-7012
 * override_risk_score=90, override_risk_category="Cyber/CUI", override_flow_down_required=true
 */
import { query } from '../connection.js';

export async function seedClauseOverlayAcceptance(): Promise<boolean> {
  const exists = (await query(
    `SELECT 1 FROM regulatory_clauses WHERE regulation_type = 'DFARS' AND clause_number = '252.204-7012'`
  )).rows.length > 0;
  if (!exists) {
    console.warn('[seedClauseOverlayAcceptance] regulatory_clauses has no 252.204-7012 - run reg:ingest first');
    return false;
  }

  const rc = (await query(
    `SELECT title FROM regulatory_clauses WHERE regulation_type = 'DFARS' AND clause_number = '252.204-7012'`
  )).rows[0] as { title: string };

  await query(
    `INSERT INTO clause_library_items (
      clause_number, regulation_type, title, type,
      override_risk_category, override_risk_score, override_flow_down_required,
      override_suggested_mitigation, tags, notes, active, updated_at
    ) VALUES (
      '252.204-7012', 'DFARS', $1, 'DFARS',
      'Cyber/CUI', 90, true,
      'Implement NIST SP 800-171 controls; assess and report cyber incidents within 72 hours.',
      '["CUI", "cyber", "DFARS"]'::jsonb,
      'Acceptance test overlay: effective values override base.',
      true, NOW()
    )
    ON CONFLICT (regulation_type, clause_number) DO UPDATE SET
      override_risk_category = EXCLUDED.override_risk_category,
      override_risk_score = EXCLUDED.override_risk_score,
      override_flow_down_required = EXCLUDED.override_flow_down_required,
      override_suggested_mitigation = EXCLUDED.override_suggested_mitigation,
      tags = EXCLUDED.tags,
      notes = EXCLUDED.notes,
      updated_at = NOW()`,
    [rc.title]
  );
  return true;
}
