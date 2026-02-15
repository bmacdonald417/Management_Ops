import { createHash } from 'crypto';
import { query } from '../../db/connection.js';
import { chunkDocument } from './chunk.js';
import type { DocType } from './types.js';

function computeTextHash(text: string | null): string | null {
  if (!text || text.trim().length === 0) return null;
  return createHash('sha256').update(text.trim(), 'utf8').digest('hex');
}

function buildCanonicalRef(docType: string, externalId: string | null, dataSourceId: string | null): string {
  const parts = [docType];
  if (externalId) parts.push(externalId.replace(/\s+/g, '_'));
  if (dataSourceId) parts.push(dataSourceId.slice(0, 8));
  return parts.join('|');
}

export async function upsertDocument(params: {
  dataSourceId?: string;
  docType: DocType;
  externalId?: string;
  title: string;
  fullText?: string | null;
  sourceUrl?: string;
  meta?: Record<string, unknown>;
  isActive?: boolean;
}): Promise<string> {
  const { dataSourceId, docType, externalId, title, fullText, sourceUrl, meta, isActive = true } = params;
  const canonicalRef = buildCanonicalRef(docType, externalId ?? null, dataSourceId ?? null);
  const textHash = computeTextHash(fullText ?? null);

  const existing = (await query(
    `SELECT id, text_hash, full_text FROM compliance_documents WHERE canonical_ref = $1`,
    [canonicalRef]
  )).rows[0] as { id: string; text_hash: string | null; full_text: string | null } | undefined;

  if (existing) {
    const hashChanged = existing.text_hash !== textHash;
    await query(
      `UPDATE compliance_documents SET
        data_source_id = COALESCE($2, data_source_id),
        title = $3, full_text = $4, text_hash = $5, source_url = COALESCE($6, source_url),
        meta = COALESCE($7, meta), is_active = $8, updated_at = NOW()
       WHERE id = $1`,
      [existing.id, dataSourceId ?? null, title, fullText ?? null, textHash, sourceUrl ?? null, meta ? JSON.stringify(meta) : null, isActive]
    );
    if (hashChanged && fullText) {
      await chunkDocument(existing.id, fullText);
    }
    return existing.id;
  }

  const r = (await query(
    `INSERT INTO compliance_documents (data_source_id, doc_type, external_id, title, canonical_ref, source_url, full_text, text_hash, meta, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [dataSourceId ?? null, docType, externalId ?? null, title, canonicalRef, sourceUrl ?? null, fullText ?? null, textHash, meta ? JSON.stringify(meta) : null, isActive]
  )).rows[0] as { id: string };

  if (fullText) await chunkDocument(r.id, fullText);
  return r.id;
}

export async function ingestClausesFromClauseMaster(dataSourceId: string): Promise<number> {
  const rows = (await query(
    `SELECT clause_number, title, regulation, category, risk_level, flow_down, description, full_text
     FROM clause_master WHERE data_source_id = $1`,
    [dataSourceId]
  )).rows as { clause_number: string; title: string; regulation: string; category?: string; risk_level?: number; flow_down?: string; description?: string; full_text?: string }[];

  let count = 0;
  for (const r of rows) {
    const externalId = `${r.regulation} ${r.clause_number}`.trim();
    const fullText = [r.title, r.description, r.full_text].filter(Boolean).join('\n\n') || r.title;
    await upsertDocument({
      dataSourceId,
      docType: 'CLAUSE',
      externalId,
      title: r.title,
      fullText,
      meta: { clause_number: r.clause_number, regulation: r.regulation, category: r.category, risk_level: r.risk_level, flow_down: r.flow_down }
    });
    count++;
  }
  return count;
}

export async function ingestControlsFromCyberControlMaster(dataSourceId: string): Promise<number> {
  const rows = (await query(
    `SELECT control_identifier, domain, level, practice_statement, objective
     FROM cyber_control_master WHERE data_source_id = $1`,
    [dataSourceId]
  )).rows as { control_identifier: string; domain: string; level: string; practice_statement: string; objective?: string }[];

  let count = 0;
  for (const r of rows) {
    const fullText = [r.practice_statement, r.objective].filter(Boolean).join('\n\n');
    await upsertDocument({
      dataSourceId,
      docType: 'CONTROL',
      externalId: r.control_identifier,
      title: r.control_identifier,
      fullText: fullText || r.practice_statement,
      meta: { domain: r.domain, level: r.level }
    });
    count++;
  }
  return count;
}

export async function ingestTemplatesFromJSON(
  dataSourceId: string | undefined,
  templates: { name: string; type?: string; text: string; meta?: Record<string, unknown> }[]
): Promise<number> {
  let count = 0;
  for (const t of templates) {
    await upsertDocument({
      dataSourceId,
      docType: 'TEMPLATE',
      externalId: t.name,
      title: t.name,
      fullText: t.text,
      meta: { template_type: t.type, ...t.meta }
    });
    count++;
  }
  return count;
}

export async function ingestManualSectionsFromInternalText(
  sections: { id: string; title: string; content: string; part?: string }[]
): Promise<number> {
  let count = 0;
  for (const s of sections) {
    await upsertDocument({
      docType: 'MANUAL_SECTION',
      externalId: s.id,
      title: s.title,
      fullText: s.content,
      meta: { part: s.part }
    });
    count++;
  }
  return count;
}

export async function syncDocumentsFromRegistry(): Promise<{ clauses: number; controls: number }> {
  const activeSources = (await query(
    `SELECT id, category FROM compliance_data_sources WHERE is_active = true AND validation_status = 'VALID'`
  )).rows as { id: string; category: string }[];

  let clauses = 0;
  let controls = 0;
  for (const src of activeSources) {
    if (['FAR', 'DFARS', 'INTERNAL'].includes(src.category)) {
      clauses += await ingestClausesFromClauseMaster(src.id);
    }
    if (['CMMC', 'NIST'].includes(src.category)) {
      controls += await ingestControlsFromCyberControlMaster(src.id);
    }
  }
  return { clauses, controls };
}
