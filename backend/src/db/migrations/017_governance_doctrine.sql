-- Phase 3: Completeness Index & Doctrine Builder
-- Governance doctrine document with sections and per-section completeness tracking.

CREATE TABLE IF NOT EXISTS governance_doctrine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  version VARCHAR(50) NOT NULL DEFAULT '1.0',
  purpose TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_doctrine_updated ON governance_doctrine(updated_at);

CREATE TABLE IF NOT EXISTS doctrine_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governance_doctrine_id UUID NOT NULL REFERENCES governance_doctrine(id) ON DELETE CASCADE,
  section_number VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  copilot_suggestions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(governance_doctrine_id, section_number)
);

CREATE INDEX IF NOT EXISTS idx_doctrine_sections_doctrine ON doctrine_sections(governance_doctrine_id);

CREATE TABLE IF NOT EXISTS doctrine_completeness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctrine_section_id UUID NOT NULL REFERENCES doctrine_sections(id) ON DELETE CASCADE,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  completed_by_id UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doctrine_section_id)
);

CREATE INDEX IF NOT EXISTS idx_doctrine_completeness_section ON doctrine_completeness(doctrine_section_id);
