-- Phase 2.3: Controlled document metadata per Section 1.6.
-- Version numbers, revision dates, and approval signature placeholders.

ALTER TABLE governance_doctrine ADD COLUMN IF NOT EXISTS revision_date DATE;
ALTER TABLE governance_doctrine ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id);
ALTER TABLE governance_doctrine ADD COLUMN IF NOT EXISTS approval_placeholder TEXT;

COMMENT ON COLUMN governance_doctrine.revision_date IS 'Revision date for controlled document (Section 1.6).';
COMMENT ON COLUMN governance_doctrine.approved_by_id IS 'User who approved this version (controlled document).';
COMMENT ON COLUMN governance_doctrine.approval_placeholder IS 'Placeholder text for approval signature block (e.g. "Approved by: ___________ Date: ___").';
