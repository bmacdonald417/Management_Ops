-- Phase 1: Unified Clause Library
-- Single source of truth: unified_clause_master (+ optional versioning).
-- Replaces use of regulatory_clauses + clause_library_items for engine/clause library;
-- compliance_clauses and clause_master (registry) remain for legacy/import until Phase 2.

CREATE TABLE IF NOT EXISTS unified_clause_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clause_number VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  full_text TEXT NOT NULL DEFAULT '',
  regulation VARCHAR(20) NOT NULL CHECK (regulation IN ('FAR', 'DFARS')),
  part VARCHAR(20) NOT NULL DEFAULT '',
  subpart VARCHAR(50),
  hierarchy_level INTEGER,
  is_prescribed BOOLEAN NOT NULL DEFAULT false,
  is_flow_down BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(50) NOT NULL DEFAULT 'ingestRegulations' CHECK (source IN ('ingestRegulations', 'manual', 'qms_import', 'compliance_clauses', 'clause_library', 'registry_import')),
  -- Base risk (from ingest or first source)
  risk_category VARCHAR(100),
  risk_score INTEGER,
  -- Overlay fields (merged from clause_library_items)
  override_risk_category VARCHAR(100),
  override_risk_score INTEGER,
  override_flow_down_required BOOLEAN,
  override_suggested_mitigation TEXT,
  overlay_tags JSONB DEFAULT '[]'::jsonb,
  overlay_notes TEXT,
  flow_down_notes TEXT,
  updated_by_id UUID REFERENCES users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(regulation, clause_number)
);

CREATE INDEX IF NOT EXISTS idx_unified_clause_master_reg ON unified_clause_master(regulation);
CREATE INDEX IF NOT EXISTS idx_unified_clause_master_number ON unified_clause_master(clause_number);
CREATE INDEX IF NOT EXISTS idx_unified_clause_master_source ON unified_clause_master(source);

CREATE TABLE IF NOT EXISTS unified_clause_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_clause_master_id UUID NOT NULL REFERENCES unified_clause_master(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  summary_of_changes TEXT,
  effective_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(unified_clause_master_id, version)
);

CREATE INDEX IF NOT EXISTS idx_unified_clause_versions_master ON unified_clause_versions(unified_clause_master_id);
