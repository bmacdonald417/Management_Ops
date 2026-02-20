-- Phase 1: Mark legacy solicitation workflow tables as deprecated.
-- No code paths should write to these after migration to engine.
-- deprecated_at set to NOW() when migration is complete (optional manual step).

ALTER TABLE solicitation_versions ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ;
ALTER TABLE clause_review_entries ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ;

COMMENT ON COLUMN solicitation_versions.deprecated_at IS 'Legacy workflow deprecated; use solicitation_clauses + engine.';
COMMENT ON COLUMN clause_review_entries.deprecated_at IS 'Legacy workflow deprecated; use clause_risk_assessments.';
