-- Phase 2: Proposal & Governance Automation Engine
-- Proposals linked to solicitations; sections (content) and forms (QMS) for document generation.

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID REFERENCES solicitations(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_REVIEW', 'SUBMITTED', 'AWARDED', 'ARCHIVED')),
  proposal_type VARCHAR(30) NOT NULL DEFAULT 'Solicitation' CHECK (proposal_type IN ('RFP', 'SOW', 'Solicitation')),
  submission_deadline TIMESTAMPTZ,
  generated_document_path VARCHAR(1000),
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_solicitation ON proposals(solicitation_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created ON proposals(created_at);

CREATE TABLE IF NOT EXISTS proposal_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  copilot_suggestions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_sections_proposal ON proposal_sections(proposal_id);

CREATE TABLE IF NOT EXISTS proposal_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  qms_document_id VARCHAR(255) NOT NULL,
  form_name VARCHAR(255) NOT NULL,
  form_data JSONB DEFAULT '{}'::jsonb,
  completed_qms_document_id VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_forms_proposal ON proposal_forms(proposal_id);
