-- Phase 1.3: Point contract_clauses at unified_clause_master for SSOT.
-- contract_clauses.clause_id remains (FK to compliance_clauses) for backward compatibility.
-- Backfill: set unified_clause_master_id from compliance_clauses via (regulation, clause_number).

ALTER TABLE contract_clauses ADD COLUMN IF NOT EXISTS unified_clause_master_id UUID REFERENCES unified_clause_master(id) ON DELETE SET NULL;

UPDATE contract_clauses ccl
SET unified_clause_master_id = u.id
FROM compliance_clauses cc
JOIN unified_clause_master u ON u.regulation = cc.regulation AND u.clause_number = cc.clause_number
WHERE ccl.clause_id = cc.id AND ccl.unified_clause_master_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contract_clauses_unified_master ON contract_clauses(unified_clause_master_id);

COMMENT ON COLUMN contract_clauses.unified_clause_master_id IS 'SSOT clause reference; backfilled from compliance_clauses where (regulation, clause_number) matches unified_clause_master.';
