-- Phase 1: Point solicitation_clauses at unified_clause_master.
-- Run after migrateClauseData.ts so unified_clause_master is populated.

ALTER TABLE solicitation_clauses ADD COLUMN IF NOT EXISTS unified_clause_master_id UUID REFERENCES unified_clause_master(id) ON DELETE CASCADE;

-- Backfill: set unified_clause_master_id from existing clause_id (regulatory_clauses)
UPDATE solicitation_clauses sc
SET unified_clause_master_id = u.id
FROM regulatory_clauses rc
JOIN unified_clause_master u ON u.regulation = rc.regulation_type AND u.clause_number = rc.clause_number
WHERE sc.clause_id = rc.id AND sc.unified_clause_master_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_solicitation_clauses_unified_master ON solicitation_clauses(unified_clause_master_id);

-- Keep clause_id nullable for legacy; new code uses unified_clause_master_id
-- (No change to clause_id NOT NULL here to avoid breaking existing rows; can be made nullable in a later migration if desired)
