-- Phase 1: Prevent governance_completeness_index duplicates
-- Remove duplicates (keep latest per scope+solicitation_id) before adding constraint
DELETE FROM governance_completeness_index a
USING governance_completeness_index b
WHERE a.ctid < b.ctid
  AND a.scope = b.scope
  AND (a.solicitation_id = b.solicitation_id OR (a.solicitation_id IS NULL AND b.solicitation_id IS NULL));

-- Add unique constraint so upsert overwrites existing records
ALTER TABLE governance_completeness_index
  DROP CONSTRAINT IF EXISTS gov_completeness_scope_sol_uniq;

ALTER TABLE governance_completeness_index
  ADD CONSTRAINT gov_completeness_scope_sol_uniq UNIQUE (scope, solicitation_id);
