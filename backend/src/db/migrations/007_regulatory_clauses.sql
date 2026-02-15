-- Regulatory clauses (FAR 52, DFARS 252) with risk classification

CREATE TABLE IF NOT EXISTS regulatory_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_type VARCHAR(20) NOT NULL CHECK (regulation_type IN ('FAR', 'DFARS')),
  part VARCHAR(20) NOT NULL,
  clause_number VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  full_text TEXT NOT NULL,
  subpart VARCHAR(50),
  hierarchy_level INTEGER,
  risk_category VARCHAR(100),
  risk_score INTEGER,
  flow_down_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(regulation_type, clause_number)
);

CREATE INDEX IF NOT EXISTS idx_regulatory_clauses_clause_number ON regulatory_clauses(clause_number);
CREATE INDEX IF NOT EXISTS idx_regulatory_clauses_regulation_type ON regulatory_clauses(regulation_type);
CREATE INDEX IF NOT EXISTS idx_regulatory_clauses_risk_score ON regulatory_clauses(risk_score);

-- Governance requirements: link high-risk clauses to Government Completeness Index
CREATE TABLE IF NOT EXISTS governance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(100) NOT NULL,
  weight INTEGER NOT NULL,
  reference_id UUID REFERENCES regulatory_clauses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_requirements_reference ON governance_requirements(reference_id);
CREATE INDEX IF NOT EXISTS idx_governance_requirements_domain ON governance_requirements(domain);
