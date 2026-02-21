-- Finalize CMMC Dashboard tables: add evidence_file_count and evidence files tracking
-- This migration enhances the CMMC dashboard with evidence file counts and detailed evidence tracking

-- Add evidence_file_count column to cmmc_adjudicated_controls if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cmmc_adjudicated_controls' 
    AND column_name = 'evidence_file_count'
  ) THEN
    ALTER TABLE cmmc_adjudicated_controls 
    ADD COLUMN evidence_file_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add updated_at timestamp if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cmmc_adjudicated_controls' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE cmmc_adjudicated_controls 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create table for evidence files linked to controls (if it doesn't exist)
CREATE TABLE IF NOT EXISTS cmmc_control_evidence_files (
    id SERIAL PRIMARY KEY,
    control_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    sha256 TEXT,
    last_seen_ingest_id INTEGER NOT NULL REFERENCES cmmc_evidence_ingest_log(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cmmc_evidence_files_control ON cmmc_control_evidence_files(control_id);
CREATE INDEX IF NOT EXISTS idx_cmmc_evidence_files_ingest ON cmmc_control_evidence_files(last_seen_ingest_id);
