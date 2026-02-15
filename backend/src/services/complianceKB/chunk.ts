import { createHash } from 'crypto';
import { query } from '../../db/connection.js';
import { TARGET_CHUNK_CHARS } from './types.js';

export function computeHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function splitIntoChunks(text: string): { content: string; startChar: number; endChar: number }[] {
  if (!text || text.trim().length === 0) return [];
  const chunks: { content: string; startChar: number; endChar: number }[] = [];
  const { min, max } = TARGET_CHUNK_CHARS;
  let start = 0;
  const normalized = text.replace(/\r\n/g, '\n');

  while (start < normalized.length) {
    let end = Math.min(start + max, normalized.length);
    if (end < normalized.length) {
      const searchEnd = Math.min(end + 100, normalized.length);
      const slice = normalized.slice(start, searchEnd);
      const lastPara = slice.lastIndexOf('\n\n');
      const lastPeriod = slice.lastIndexOf('. ');
      let splitAt = end - start;
      if (lastPara >= min && lastPara <= slice.length) splitAt = lastPara + 2;
      else if (lastPeriod >= min && lastPeriod <= slice.length) splitAt = lastPeriod + 2;
      else {
        const space = slice.lastIndexOf(' ');
        if (space > min) splitAt = space + 1;
      }
      end = start + splitAt;
    }
    const content = normalized.slice(start, end).trim();
    if (content.length > 0) chunks.push({ content, startChar: start, endChar: end });
    start = end;
  }
  return chunks;
}

export async function chunkDocument(documentId: string, fullText: string | null): Promise<number> {
  if (!fullText || fullText.trim().length === 0) {
    await query(`DELETE FROM compliance_chunks WHERE document_id = $1`, [documentId]);
    return 0;
  }

  const chunks = splitIntoChunks(fullText);
  const existing = (await query(
    `SELECT chunk_index, content_hash FROM compliance_chunks WHERE document_id = $1 ORDER BY chunk_index`,
    [documentId]
  )).rows as { chunk_index: number; content_hash: string }[];

  let inserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const { content, startChar, endChar } = chunks[i];
    const contentHash = computeHash(content);
    const existingChunk = existing.find((c) => c.chunk_index === i);

    if (existingChunk) {
      if (existingChunk.content_hash !== contentHash) {
        await query(
          `UPDATE compliance_chunks SET content = $2, content_hash = $3, start_char = $4, end_char = $5, embedding = NULL, embedded_at = NULL, embedding_model = NULL WHERE document_id = $1 AND chunk_index = $6`,
          [documentId, content, contentHash, startChar, endChar, i]
        );
      }
    } else {
      await query(
        `INSERT INTO compliance_chunks (document_id, chunk_index, content, content_hash, start_char, end_char) VALUES ($1, $2, $3, $4, $5, $6)`,
        [documentId, i, content, contentHash, startChar, endChar]
      );
      inserted++;
    }
  }

  if (chunks.length < existing.length) {
    await query(
      `DELETE FROM compliance_chunks WHERE document_id = $1 AND chunk_index >= $2`,
      [documentId, chunks.length]
    );
  }

  return chunks.length;
}

export async function chunkAllDocuments(): Promise<{ processed: number; totalChunks: number }> {
  const docs = (await query(
    `SELECT id, full_text FROM compliance_documents WHERE is_active = true AND full_text IS NOT NULL AND full_text != ''`
  )).rows as { id: string; full_text: string }[];

  let totalChunks = 0;
  for (const doc of docs) {
    const count = await chunkDocument(doc.id, doc.full_text);
    totalChunks += count;
  }
  return { processed: docs.length, totalChunks };
}
