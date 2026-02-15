-- Copilot Run History (auditable AI assistant usage)
CREATE TABLE IF NOT EXISTS copilot_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode VARCHAR(50) NOT NULL,
  payload_json JSONB NOT NULL,
  result_json JSONB,
  actor_id UUID REFERENCES users(id),
  related_entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_copilot_runs_actor ON copilot_runs(actor_id);
CREATE INDEX IF NOT EXISTS idx_copilot_runs_mode ON copilot_runs(mode);
CREATE INDEX IF NOT EXISTS idx_copilot_runs_created ON copilot_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_copilot_runs_related ON copilot_runs(related_entity_id);
