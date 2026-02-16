-- QMS form record linkage for clause assessments
CREATE TABLE IF NOT EXISTS clause_assessment_form_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  solicitation_clause_id UUID NOT NULL REFERENCES solicitation_clauses(id) ON DELETE CASCADE,
  clause_risk_assessment_id UUID NOT NULL REFERENCES clause_risk_assessments(id) ON DELETE CASCADE,
  qms_form_record_id VARCHAR(255) NOT NULL,
  template_code VARCHAR(50) NOT NULL DEFAULT 'MAC-FRM-013',
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clause_risk_assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_clause_assessment_form_links_sol ON clause_assessment_form_links(solicitation_id);
CREATE INDEX IF NOT EXISTS idx_clause_assessment_form_links_qms ON clause_assessment_form_links(qms_form_record_id);
