-- Upgrade clause_library_items for enterprise Clause Library
-- Run this after schema.sql for existing installations

-- Add type: FAR, DFARS, AGENCY, OTHER
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'OTHER';
-- Add flow_down: YES, NO, CONDITIONAL
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS flow_down VARCHAR(20) DEFAULT 'CONDITIONAL';
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS flow_down_notes TEXT;
-- Add suggested risk level for library browsing (L1-L4)
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS suggested_risk_level INTEGER CHECK (suggested_risk_level BETWEEN 1 AND 4);
-- Track who last updated
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Backfill type from clause_number pattern (252. = DFARS, 52. = FAR)
UPDATE clause_library_items SET type = 'DFARS' WHERE clause_number LIKE '252.%' AND (type IS NULL OR type = 'OTHER');
UPDATE clause_library_items SET type = 'FAR' WHERE (clause_number LIKE '52.%' OR clause_number LIKE 'FAR 52.%') AND (type IS NULL OR type = 'OTHER');

-- Indexes for filtering (only if column exists - production-safe)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clause_library_items' AND column_name = 'type') THEN
    CREATE INDEX IF NOT EXISTS idx_clause_library_type ON clause_library_items(type);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clause_library_items' AND column_name = 'flow_down') THEN
    CREATE INDEX IF NOT EXISTS idx_clause_library_flow_down ON clause_library_items(flow_down);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clause_library_items' AND column_name = 'suggested_risk_level') THEN
    CREATE INDEX IF NOT EXISTS idx_clause_library_suggested_risk ON clause_library_items(suggested_risk_level);
  END IF;
END $$;
