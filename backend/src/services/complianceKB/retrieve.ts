import { query } from '../../db/connection.js';
import { embedText } from './embeddings.js';
import type { RetrieveResult } from './types.js';

export async function retrieveRelevantChunks(
  queryText: string,
  filters: { docType?: string[]; category?: string[]; externalIdPrefix?: string } = {},
  topK: number = 8
): Promise<RetrieveResult[]> {
  const vec = await embedText(queryText);
  if (!vec || vec.length === 0) {
    return [];
  }

  const vecStr = '[' + vec.join(',') + ']';

  let sql = `
    SELECT c.id as chunk_id, c.content, c.document_id,
           d.title, d.external_id, d.canonical_ref, d.source_url, d.doc_type,
           d.data_source_id, ds.category as ds_category,
           1 - (c.embedding <=> $1::vector) as similarity
    FROM compliance_chunks c
    JOIN compliance_documents d ON d.id = c.document_id
    LEFT JOIN compliance_data_sources ds ON ds.id = d.data_source_id
    WHERE c.embedding IS NOT NULL AND d.is_active = true
  `;
  const params: unknown[] = [vecStr];
  let i = 2;

  if (filters.docType && filters.docType.length > 0) {
    sql += ` AND d.doc_type = ANY($${i++})`;
    params.push(filters.docType);
  }
  if (filters.category && filters.category.length > 0) {
    sql += ` AND ds.category = ANY($${i++})`;
    params.push(filters.category);
  }
  if (filters.externalIdPrefix) {
    sql += ` AND (d.external_id LIKE $${i++} OR d.canonical_ref LIKE $${i})`;
    params.push(filters.externalIdPrefix + '%', filters.externalIdPrefix + '%');
    i++;
  }

  sql += ` ORDER BY c.embedding <=> $1::vector LIMIT $${i}`;
  params.push(topK);

  const rows = (await query(sql, params)).rows as {
    chunk_id: string;
    content: string;
    document_id: string;
    title: string;
    external_id?: string;
    canonical_ref?: string;
    source_url?: string;
    doc_type: string;
    similarity: number;
  }[];

  return rows.map((r) => ({
    chunkId: r.chunk_id,
    content: r.content,
    documentId: r.document_id,
    title: r.title,
    externalId: r.external_id,
    canonicalRef: r.canonical_ref,
    sourceUrl: r.source_url,
    similarity: Math.round(r.similarity * 1000) / 1000,
    docType: r.doc_type
  }));
}
