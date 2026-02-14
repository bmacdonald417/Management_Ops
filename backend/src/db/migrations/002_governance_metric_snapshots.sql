-- Governance Metric Snapshots for GCI (Governance Completeness Index)
CREATE TABLE IF NOT EXISTS governance_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overall_score DECIMAL(5,2) NOT NULL,
  pillar_contract DECIMAL(5,2) NOT NULL,
  pillar_financial DECIMAL(5,2) NOT NULL,
  pillar_cyber DECIMAL(5,2) NOT NULL,
  pillar_insurance DECIMAL(5,2) NOT NULL,
  pillar_structural DECIMAL(5,2) NOT NULL,
  pillar_audit DECIMAL(5,2) NOT NULL,
  pillar_documentation DECIMAL(5,2) NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gov_metric_snapshots_computed ON governance_metric_snapshots(computed_at);
