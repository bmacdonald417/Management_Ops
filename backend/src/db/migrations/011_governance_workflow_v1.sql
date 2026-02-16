-- Governance Engine Workflow v1: flowdown review, base/assessed/effective scores

-- clause_risk_assessments: flowdown review + scoring fields
ALTER TABLE clause_risk_assessments ADD COLUMN IF NOT EXISTS flowdown_review_completed BOOLEAN DEFAULT false;
ALTER TABLE clause_risk_assessments ADD COLUMN IF NOT EXISTS base_risk_score INTEGER;
ALTER TABLE clause_risk_assessments ADD COLUMN IF NOT EXISTS assessed_risk_score INTEGER;
ALTER TABLE clause_risk_assessments ADD COLUMN IF NOT EXISTS effective_final_risk_score INTEGER;

-- Backfill: use risk_score_percent as assessed/effective where missing
UPDATE clause_risk_assessments SET assessed_risk_score = risk_score_percent
  WHERE assessed_risk_score IS NULL AND risk_score_percent IS NOT NULL;
UPDATE clause_risk_assessments SET effective_final_risk_score = risk_score_percent
  WHERE effective_final_risk_score IS NULL AND risk_score_percent IS NOT NULL;

-- risk_model_config: score thresholds for L2/L3/L4 (0-100)
INSERT INTO risk_model_config (config_key, config_value) VALUES
  ('score_threshold_l2', '25'),
  ('score_threshold_l3', '50'),
  ('score_threshold_l4', '75')
ON CONFLICT (config_key) DO NOTHING;
