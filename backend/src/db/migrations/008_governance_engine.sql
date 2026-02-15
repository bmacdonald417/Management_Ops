-- Governance Engine: Solicitation Clause Review + Risk Scoring + Clause Risk Log
-- Strict pre-bid workflow with gated approvals

-- Extend solicitations with new columns (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitations' AND column_name = 'customer') THEN
    ALTER TABLE solicitations ADD COLUMN customer VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitations' AND column_name = 'source_url') THEN
    ALTER TABLE solicitations ADD COLUMN source_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitations' AND column_name = 'period_of_performance') THEN
    ALTER TABLE solicitations ADD COLUMN period_of_performance VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitations' AND column_name = 'created_by_user_id') THEN
    ALTER TABLE solicitations ADD COLUMN created_by_user_id UUID REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitations' AND column_name = 'set_aside') THEN
    ALTER TABLE solicitations ADD COLUMN set_aside VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitations' AND column_name = 'anticipated_value') THEN
    ALTER TABLE solicitations ADD COLUMN anticipated_value DECIMAL(18,2);
  END IF;
END $$;

-- SolicitationClause: join solicitation <-> regulatory_clauses
CREATE TABLE IF NOT EXISTS solicitation_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  clause_id UUID NOT NULL REFERENCES regulatory_clauses(id) ON DELETE CASCADE,
  detected_from VARCHAR(50) NOT NULL DEFAULT 'MANUAL_ADD' CHECK (detected_from IN ('PASTED_TEXT', 'UPLOADED_FILE', 'MANUAL_ADD', 'API_IMPORT')),
  detected_confidence DECIMAL(3,2) CHECK (detected_confidence >= 0 AND detected_confidence <= 1),
  is_flow_down_required BOOLEAN DEFAULT true,
  is_applicable BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(solicitation_id, clause_id)
);

CREATE INDEX IF NOT EXISTS idx_solicitation_clauses_sol ON solicitation_clauses(solicitation_id);
CREATE INDEX IF NOT EXISTS idx_solicitation_clauses_clause ON solicitation_clauses(clause_id);

-- ClauseRiskAssessment
CREATE TABLE IF NOT EXISTS clause_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_clause_id UUID NOT NULL REFERENCES solicitation_clauses(id) ON DELETE CASCADE,
  risk_level VARCHAR(2) NOT NULL CHECK (risk_level IN ('L1', 'L2', 'L3', 'L4')),
  risk_score_percent INTEGER NOT NULL CHECK (risk_score_percent >= 0 AND risk_score_percent <= 100),
  risk_category VARCHAR(50) NOT NULL,
  rationale TEXT,
  recommended_mitigation TEXT,
  requires_flow_down BOOLEAN DEFAULT false,
  approval_tier_required VARCHAR(20) CHECK (approval_tier_required IN ('NONE', 'MANAGER', 'QUALITY', 'EXEC')),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  assessed_by_user_id UUID REFERENCES users(id),
  assessed_at TIMESTAMPTZ,
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clause_risk_assessments_sol_clause ON clause_risk_assessments(solicitation_clause_id);
CREATE INDEX IF NOT EXISTS idx_clause_risk_assessments_status ON clause_risk_assessments(status);

-- ClauseReviewTask
CREATE TABLE IF NOT EXISTS clause_review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('EXTRACTION_REVIEW', 'RISK_ASSESSMENT', 'FLOW_DOWN_REVIEW', 'FINAL_APPROVAL')),
  assigned_role VARCHAR(30) CHECK (assigned_role IN ('MANAGER', 'QUALITY', 'SYSADMIN')),
  assigned_user_id UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'OVERDUE')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clause_review_tasks_sol ON clause_review_tasks(solicitation_id);

-- ClauseRiskLogSnapshot (immutable)
CREATE TABLE IF NOT EXISTS clause_risk_log_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by_user_id UUID REFERENCES users(id),
  overall_risk_level VARCHAR(2) NOT NULL,
  overall_risk_score_percent INTEGER NOT NULL,
  open_findings_count INTEGER DEFAULT 0,
  high_risk_clause_count INTEGER DEFAULT 0,
  json_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clause_risk_log_sol ON clause_risk_log_snapshots(solicitation_id);
CREATE INDEX IF NOT EXISTS idx_clause_risk_log_generated ON clause_risk_log_snapshots(generated_at);

-- GovernanceCompletenessIndex
CREATE TABLE IF NOT EXISTS governance_completeness_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('SOLICITATION', 'ORG')),
  solicitation_id UUID REFERENCES solicitations(id) ON DELETE CASCADE,
  percent_complete INTEGER NOT NULL CHECK (percent_complete >= 0 AND percent_complete <= 100),
  missing_items_json JSONB,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_completeness_scope ON governance_completeness_index(scope);
CREATE INDEX IF NOT EXISTS idx_gov_completeness_sol ON governance_completeness_index(solicitation_id);

-- Risk engine config (weights, hard stops, category hints)
INSERT INTO risk_model_config (config_key, config_value) VALUES
  ('solicitation_weights', '{"financial": 0.25, "schedule": 0.15, "audit": 0.15, "cyber": 0.20, "flow_down": 0.10, "insurance": 0.10, "ip": 0.05}'::jsonb),
  ('hard_stop_clauses', '["252.204-7012", "252.204-7021", "52.249-2", "52.215-2"]'::jsonb),
  ('risk_log_freshness_days', '7'::jsonb)
ON CONFLICT (config_key) DO NOTHING;
