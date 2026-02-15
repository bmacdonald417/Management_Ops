-- Compliance Data Registry
-- Structured registry for FAR, DFARS, CMMC, Cost Accounts, Insurance, etc.

CREATE TABLE IF NOT EXISTS compliance_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('FAR', 'DFARS', 'CMMC', 'NIST', 'ISO', 'INSURANCE', 'COST_ACCOUNT', 'INTERNAL')),
  version VARCHAR(50) NOT NULL,
  effective_date DATE,
  file_name VARCHAR(500),
  record_count INTEGER DEFAULT 0,
  hash_fingerprint VARCHAR(64),
  validation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID')),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  imported_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, version)
);

CREATE INDEX IF NOT EXISTS idx_compliance_data_sources_category ON compliance_data_sources(category);
CREATE INDEX IF NOT EXISTS idx_compliance_data_sources_status ON compliance_data_sources(validation_status);
CREATE INDEX IF NOT EXISTS idx_compliance_data_sources_active ON compliance_data_sources(category, is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS compliance_registry_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES compliance_data_sources(id) ON DELETE CASCADE,
  row_index INTEGER,
  field_name VARCHAR(100),
  error_code VARCHAR(50),
  error_message TEXT NOT NULL,
  raw_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registry_errors_source ON compliance_registry_errors(data_source_id);

-- ClauseMaster: normalized FAR/DFARS clause data from registry imports
CREATE TABLE IF NOT EXISTS clause_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES compliance_data_sources(id) ON DELETE CASCADE,
  clause_number VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  regulation VARCHAR(20) NOT NULL,
  category VARCHAR(100),
  risk_level INTEGER CHECK (risk_level IS NULL OR (risk_level >= 1 AND risk_level <= 4)),
  flow_down VARCHAR(20) DEFAULT 'CONDITIONAL',
  description TEXT,
  full_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(data_source_id, clause_number)
);

CREATE INDEX IF NOT EXISTS idx_clause_master_source ON clause_master(data_source_id);
CREATE INDEX IF NOT EXISTS idx_clause_master_number ON clause_master(clause_number);
CREATE INDEX IF NOT EXISTS idx_clause_master_regulation ON clause_master(regulation);

-- CyberControlMaster: CMMC/NIST control definitions from registry
CREATE TABLE IF NOT EXISTS cyber_control_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES compliance_data_sources(id) ON DELETE CASCADE,
  control_identifier VARCHAR(50) NOT NULL,
  domain VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL,
  practice_statement TEXT NOT NULL,
  objective TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(data_source_id, control_identifier)
);

CREATE INDEX IF NOT EXISTS idx_cyber_control_master_source ON cyber_control_master(data_source_id);
CREATE INDEX IF NOT EXISTS idx_cyber_control_master_identifier ON cyber_control_master(control_identifier);

-- CostAccount: cost account / chart of accounts definitions
CREATE TABLE IF NOT EXISTS cost_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES compliance_data_sources(id) ON DELETE SET NULL,
  account_code VARCHAR(50) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50),
  is_direct BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_accounts_source ON cost_accounts(data_source_id);
CREATE INDEX IF NOT EXISTS idx_cost_accounts_code ON cost_accounts(account_code);

-- InsuranceTier: insurance minimums by tier
CREATE TABLE IF NOT EXISTS insurance_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES compliance_data_sources(id) ON DELETE SET NULL,
  tier_name VARCHAR(100) NOT NULL,
  min_general_liability DECIMAL(18,2),
  min_auto DECIMAL(18,2),
  min_professional_liability DECIMAL(18,2),
  min_cyber DECIMAL(18,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_tiers_source ON insurance_tiers(data_source_id);

-- IndemnificationTemplate: indemnification clause templates
CREATE TABLE IF NOT EXISTS indemnification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES compliance_data_sources(id) ON DELETE SET NULL,
  template_name VARCHAR(255) NOT NULL,
  template_type VARCHAR(50),
  risk_tier INTEGER CHECK (risk_tier IS NULL OR (risk_tier >= 1 AND risk_tier <= 4)),
  clause_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indemnification_templates_source ON indemnification_templates(data_source_id);
