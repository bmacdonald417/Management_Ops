-- MacTech Governance Platform - Database Schema
-- PostgreSQL

-- Users (synced with Auth0/Cognito in production)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'Level 5',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs (immutable)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  contract_number VARCHAR(100),
  agency VARCHAR(255),
  naics_code VARCHAR(20),
  contract_type VARCHAR(100),
  period_of_performance_start DATE,
  period_of_performance_end DATE,
  total_contract_value DECIMAL(18,2) DEFAULT 0,
  funded_amount DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Opportunity',
  risk_profile_id UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_agency ON contracts(agency);
CREATE INDEX IF NOT EXISTS idx_contracts_deleted ON contracts(deleted_at) WHERE deleted_at IS NULL;

-- Risk Profiles
CREATE TABLE IF NOT EXISTS risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  strategic_risk_level INTEGER CHECK (strategic_risk_level BETWEEN 1 AND 4),
  financial_risk_level INTEGER CHECK (financial_risk_level BETWEEN 1 AND 4),
  regulatory_risk_level INTEGER CHECK (regulatory_risk_level BETWEEN 1 AND 4),
  cyber_risk_level INTEGER CHECK (cyber_risk_level BETWEEN 1 AND 4),
  operational_risk_level INTEGER CHECK (operational_risk_level BETWEEN 1 AND 4),
  reputational_risk_level INTEGER CHECK (reputational_risk_level BETWEEN 1 AND 4),
  overall_risk_level INTEGER CHECK (overall_risk_level BETWEEN 1 AND 4),
  status VARCHAR(50) DEFAULT 'Draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_profiles_contract ON risk_profiles(contract_id);

-- Compliance Clauses (FAR/DFARS)
CREATE TABLE IF NOT EXISTS compliance_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clause_number VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  regulation VARCHAR(20) NOT NULL,
  full_text TEXT,
  full_text_url TEXT,
  risk_category VARCHAR(100),
  risk_level INTEGER CHECK (risk_level BETWEEN 1 AND 4),
  description TEXT,
  flow_down_required BOOLEAN DEFAULT true,
  applicability_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clause_number, regulation)
);

CREATE INDEX IF NOT EXISTS idx_clauses_regulation ON compliance_clauses(regulation);
CREATE INDEX IF NOT EXISTS idx_clauses_risk_level ON compliance_clauses(risk_level);
CREATE INDEX IF NOT EXISTS idx_clauses_number ON compliance_clauses(clause_number);

-- Contract-Clause Links
CREATE TABLE IF NOT EXISTS contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  clause_id UUID NOT NULL REFERENCES compliance_clauses(id) ON DELETE CASCADE,
  compliance_status VARCHAR(50) DEFAULT 'Not Started',
  notes TEXT,
  evidence_document_ids UUID[],
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, clause_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_clauses_contract ON contract_clauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_clauses_status ON contract_clauses(compliance_status);

-- CMMC Controls (NIST 800-171)
CREATE TABLE IF NOT EXISTS cmmc_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_identifier VARCHAR(50) NOT NULL UNIQUE,
  domain VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL,
  practice_statement TEXT NOT NULL,
  objective TEXT NOT NULL,
  discussion TEXT,
  evidence_examples TEXT,
  nist_800_171_mapping VARCHAR(50),
  nist_800_53_mapping VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmmc_domain ON cmmc_controls(domain);
CREATE INDEX IF NOT EXISTS idx_cmmc_level ON cmmc_controls(level);
CREATE INDEX IF NOT EXISTS idx_cmmc_identifier ON cmmc_controls(control_identifier);

-- CMMC Assessments (per contract)
CREATE TABLE IF NOT EXISTS cmmc_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  control_id UUID NOT NULL REFERENCES cmmc_controls(id) ON DELETE CASCADE,
  implementation_status VARCHAR(50) DEFAULT 'Not Implemented',
  assessment_score INTEGER CHECK (assessment_score BETWEEN 0 AND 5),
  evidence_description TEXT,
  evidence_document_ids UUID[],
  assessor_notes TEXT,
  last_assessed_at TIMESTAMPTZ,
  assessed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, control_id)
);

CREATE INDEX IF NOT EXISTS idx_cmmc_assessments_contract ON cmmc_assessments(contract_id);
CREATE INDEX IF NOT EXISTS idx_cmmc_assessments_control ON cmmc_assessments(control_id);

-- Indirect Rates
CREATE TABLE IF NOT EXISTS indirect_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_type VARCHAR(50) NOT NULL,
  rate_value DECIMAL(10,4) NOT NULL,
  effective_date DATE NOT NULL,
  quarter VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indirect_rates_type ON indirect_rates(rate_type);
CREATE INDEX IF NOT EXISTS idx_indirect_rates_quarter ON indirect_rates(quarter);

-- Job Cost Logs
CREATE TABLE IF NOT EXISTS job_cost_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  direct_labor_cost DECIMAL(18,2) DEFAULT 0,
  direct_material_cost DECIMAL(18,2) DEFAULT 0,
  subcontractor_cost DECIMAL(18,2) DEFAULT 0,
  other_direct_cost DECIMAL(18,2) DEFAULT 0,
  fringe_burden DECIMAL(18,2) DEFAULT 0,
  overhead_burden DECIMAL(18,2) DEFAULT 0,
  ga_burden DECIMAL(18,2) DEFAULT 0,
  total_cost DECIMAL(18,2) DEFAULT 0,
  log_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_costs_contract ON job_cost_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_job_costs_date ON job_cost_logs(log_date);

-- Documents metadata
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(100),
  s3_key VARCHAR(500),
  version INTEGER DEFAULT 1,
  entity_id UUID,
  entity_type VARCHAR(100),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'Information',
  is_read BOOLEAN DEFAULT false,
  link VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Risk Escalations
CREATE TABLE IF NOT EXISTS risk_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_profile_id UUID NOT NULL REFERENCES risk_profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  escalation_level INTEGER CHECK (escalation_level BETWEEN 1 AND 4),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_escalations_profile ON risk_escalations(risk_profile_id);

-- Incident Reports (Cyber)
CREATE TABLE IF NOT EXISTS incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  incident_level INTEGER CHECK (incident_level BETWEEN 1 AND 4),
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'Investigating',
  reported_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incidents_contract ON incident_reports(contract_id);

-- Ensure default admin user exists (for dev-token login)
INSERT INTO users (auth_id, email, name, role)
VALUES ('dev-auth-1', 'admin@mactech.local', 'Dev Admin', 'Level 1')
ON CONFLICT (auth_id) DO NOTHING;
