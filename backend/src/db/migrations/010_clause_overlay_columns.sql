-- Clause Overlay Model: clause_library_items as overlay-only (regulation_type + override columns)
-- Canonical source = regulatory_clauses; overlay = clause_library_items

-- Add regulation_type (FAR|DFARS) for proper overlay matching
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS regulation_type VARCHAR(20);
UPDATE clause_library_items SET regulation_type = 
  CASE WHEN clause_number LIKE '252.%' THEN 'DFARS' 
       WHEN clause_number LIKE '52.%' OR clause_number LIKE 'FAR 52.%' THEN 'FAR' 
       ELSE COALESCE(type, 'FAR') END
  WHERE regulation_type IS NULL;
ALTER TABLE clause_library_items ALTER COLUMN regulation_type SET DEFAULT 'FAR';
UPDATE clause_library_items SET regulation_type = 'FAR' WHERE regulation_type NOT IN ('FAR', 'DFARS');
ALTER TABLE clause_library_items ALTER COLUMN regulation_type SET NOT NULL;

-- Add override-specific columns (nullable; when null, existing category/suggested_risk_level/flow_down used)
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS override_risk_category VARCHAR(100);
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS override_risk_score INTEGER;
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS override_flow_down_required BOOLEAN;
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS override_suggested_mitigation TEXT;
ALTER TABLE clause_library_items ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Backfill override_* from existing columns for backward compat
UPDATE clause_library_items SET override_risk_category = category WHERE override_risk_category IS NULL AND category IS NOT NULL;
UPDATE clause_library_items SET override_risk_score = suggested_risk_level WHERE override_risk_score IS NULL AND suggested_risk_level IS NOT NULL;
UPDATE clause_library_items SET override_flow_down_required = (flow_down = 'YES') WHERE override_flow_down_required IS NULL AND flow_down = 'YES';
UPDATE clause_library_items SET override_flow_down_required = false WHERE override_flow_down_required IS NULL AND flow_down = 'NO';

-- Unique overlay per (regulation_type, clause_number)
ALTER TABLE clause_library_items DROP CONSTRAINT IF EXISTS clause_library_items_clause_number_key;
ALTER TABLE clause_library_items DROP CONSTRAINT IF EXISTS clause_library_items_reg_clause_uniq;
ALTER TABLE clause_library_items ADD CONSTRAINT clause_library_items_reg_clause_uniq UNIQUE (regulation_type, clause_number);

CREATE INDEX IF NOT EXISTS idx_clause_library_reg_type ON clause_library_items(regulation_type);
