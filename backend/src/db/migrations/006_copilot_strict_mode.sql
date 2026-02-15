-- Strict Governance Copilot: add entity_type, entity_id, citations_json
ALTER TABLE copilot_runs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);
ALTER TABLE copilot_runs ADD COLUMN IF NOT EXISTS entity_id VARCHAR(255);
ALTER TABLE copilot_runs ADD COLUMN IF NOT EXISTS citations_json JSONB DEFAULT '[]';
