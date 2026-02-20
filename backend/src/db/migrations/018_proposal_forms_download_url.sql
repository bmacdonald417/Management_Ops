-- Phase 4: QMS Cross-Database Integration & Form Repository
-- Add download URL for completed forms stored in QMS.

ALTER TABLE proposal_forms
  ADD COLUMN IF NOT EXISTS download_url VARCHAR(1000);

COMMENT ON COLUMN proposal_forms.download_url IS 'Direct download URL for the completed form in QMS (if available).';
