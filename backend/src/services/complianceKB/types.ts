export const DOC_TYPES = ['CLAUSE', 'CONTROL', 'TEMPLATE', 'MANUAL_SECTION', 'POLICY', 'SOP', 'FRM'] as const;
export type DocType = typeof DOC_TYPES[number];

export const TARGET_CHUNK_CHARS = { min: 800, max: 1200 };
export const EMBEDDING_DIM = 1536;

export interface ComplianceDocumentRow {
  id: string;
  data_source_id?: string;
  doc_type: string;
  external_id?: string;
  title: string;
  canonical_ref?: string;
  source_url?: string;
  is_active: boolean;
  full_text?: string;
  text_hash?: string;
  meta?: Record<string, unknown>;
}

export interface ComplianceChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  content_hash: string;
  embedding?: number[] | null;
  embedding_model?: string;
  embedded_at?: string;
  token_count?: number;
  start_char?: number;
  end_char?: number;
}

export interface RetrieveResult {
  chunkId: string;
  content: string;
  documentId: string;
  title: string;
  externalId?: string;
  canonicalRef?: string;
  sourceUrl?: string;
  similarity: number;
  docType: string;
}
