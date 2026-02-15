-- Compliance Knowledge Base: full text + chunks + embeddings
-- Tries pgvector when available; falls back to JSONB when not (e.g. Railway standard Postgres)

-- Try to enable pgvector (fails gracefully when not installed)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
  RAISE NOTICE 'pgvector extension enabled';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector not available (%), using JSONB fallback for embeddings', SQLERRM;
END;
$$;

-- Compliance documents: unified store for clauses, controls, templates, manual sections
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES compliance_data_sources(id) ON DELETE SET NULL,
  doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN ('CLAUSE', 'CONTROL', 'TEMPLATE', 'MANUAL_SECTION', 'POLICY', 'SOP', 'FRM')),
  external_id VARCHAR(100),
  title VARCHAR(500) NOT NULL,
  canonical_ref VARCHAR(255),
  source_url TEXT,
  is_active BOOLEAN DEFAULT true,
  full_text TEXT,
  text_hash VARCHAR(64),
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_documents_doc_type ON compliance_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_external_id ON compliance_documents(external_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_canonical_ref ON compliance_documents(canonical_ref);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_data_source ON compliance_documents(data_source_id);

-- Compliance chunks: create with vector when available, else JSONB
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE TABLE IF NOT EXISTS compliance_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      embedding vector(1536),
      embedding_model VARCHAR(100),
      embedded_at TIMESTAMPTZ,
      token_count INTEGER,
      start_char INTEGER,
      end_char INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(document_id, chunk_index)
    );
  ELSE
    CREATE TABLE IF NOT EXISTS compliance_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      embedding JSONB,
      embedding_model VARCHAR(100),
      embedded_at TIMESTAMPTZ,
      token_count INTEGER,
      start_char INTEGER,
      end_char INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(document_id, chunk_index)
    );
  END IF;
EXCEPTION WHEN duplicate_table THEN
  NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_compliance_chunks_document ON compliance_chunks(document_id);
