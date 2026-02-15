import OpenAI from 'openai';
import { query } from '../../db/connection.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (openai) return openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  openai = new OpenAI({ apiKey: key });
  return openai;
}

export async function embedText(text: string): Promise<number[] | null> {
  const client = getOpenAI();
  if (!client) return null;
  const t = text.trim().slice(0, 8000);
  if (!t) return null;
  const r = await client.embeddings.create({ model: EMBEDDING_MODEL, input: t });
  return r.data[0]?.embedding ?? null;
}

export async function runEmbeddingJob(limit: number): Promise<{ processed: number; skipped: number; errors: number }> {
  const client = getOpenAI();
  if (!client) {
    return { processed: 0, skipped: 0, errors: 1 };
  }

  const chunks = (await query(
    `SELECT c.id, c.content, d.updated_at as doc_updated
     FROM compliance_chunks c
     JOIN compliance_documents d ON d.id = c.document_id
     WHERE c.embedding IS NULL OR c.embedded_at < d.updated_at
     ORDER BY c.embedded_at NULLS FIRST
     LIMIT $1`,
    [limit]
  )).rows as { id: string; content: string; doc_updated: string }[];

  let processed = 0;
  let errors = 0;

  for (const ch of chunks) {
    try {
      const vec = await embedText(ch.content);
      if (!vec || vec.length !== EMBEDDING_DIM) {
        errors++;
        continue;
      }
      const vecStr = '[' + vec.join(',') + ']';
      try {
        await query(
          `UPDATE compliance_chunks SET embedding = $2::vector, embedding_model = $3, embedded_at = NOW() WHERE id = $1`,
          [ch.id, vecStr, EMBEDDING_MODEL]
        );
      } catch {
        await query(
          `UPDATE compliance_chunks SET embedding = $2::jsonb, embedding_model = $3, embedded_at = NOW() WHERE id = $1`,
          [ch.id, vecStr, EMBEDDING_MODEL]
        );
      }
      processed++;
    } catch (e) {
      console.error('Embedding error:', e);
      errors++;
    }
  }

  return { processed, skipped: chunks.length - processed - errors, errors };
}

export function hasEmbeddingSupport(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
