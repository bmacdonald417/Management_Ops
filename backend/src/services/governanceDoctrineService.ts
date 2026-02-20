/**
 * Phase 3: Governance Doctrine & Completeness Index.
 * CRUD for doctrine and sections; completeness tracking; no Prisma (raw pg).
 */
import { query } from '../db/connection.js';

export interface GovernanceDoctrineRow {
  id: string;
  title: string;
  version: string;
  purpose: string | null;
  revision_date: string | null;
  approved_by_id: string | null;
  approval_placeholder: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctrineSectionRow {
  id: string;
  governance_doctrine_id: string;
  section_number: string;
  title: string;
  content: string | null;
  order: number;
  required: boolean;
  copilot_suggestions: unknown;
  created_at: string;
  updated_at: string;
  is_complete?: boolean;
  completed_at?: string | null;
  completed_by_id?: string | null;
  notes?: string | null;
}

export interface CompletenessIndexResult {
  totalSections: number;
  completedSections: number;
  completenessPercentage: number;
  sections: Array<{
    id: string;
    sectionNumber: string;
    title: string;
    isComplete: boolean;
    required: boolean;
  }>;
}

export async function createDoctrine(title: string, version: string, purpose?: string): Promise<GovernanceDoctrineRow> {
  const r = await query(
    `INSERT INTO governance_doctrine (title, version, purpose) VALUES ($1, $2, $3) RETURNING *`,
    [title, version, purpose ?? null]
  );
  return r.rows[0] as GovernanceDoctrineRow;
}

export async function getDoctrine(id: string): Promise<(GovernanceDoctrineRow & { sections: DoctrineSectionRow[] }) | null> {
  const doc = (await query(
    `SELECT * FROM governance_doctrine WHERE id = $1`,
    [id]
  )).rows[0] as GovernanceDoctrineRow | undefined;
  if (!doc) return null;

  const sections = (await query(
    `SELECT ds.*, dc.is_complete, dc.completed_at, dc.completed_by_id, dc.notes
     FROM doctrine_sections ds
     LEFT JOIN doctrine_completeness dc ON dc.doctrine_section_id = ds.id
     WHERE ds.governance_doctrine_id = $1 ORDER BY ds."order" ASC, ds.section_number ASC`,
    [id]
  )).rows as DoctrineSectionRow[];

  return { ...doc, sections };
}

export async function updateDoctrine(
  id: string,
  data: { title?: string; version?: string; purpose?: string; revision_date?: string | null; approved_by_id?: string | null; approval_placeholder?: string | null }
): Promise<GovernanceDoctrineRow | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.title !== undefined) { updates.push(`title = $${i++}`); values.push(data.title); }
  if (data.version !== undefined) { updates.push(`version = $${i++}`); values.push(data.version); }
  if (data.purpose !== undefined) { updates.push(`purpose = $${i++}`); values.push(data.purpose); }
  if (data.revision_date !== undefined) { updates.push(`revision_date = $${i++}`); values.push(data.revision_date); }
  if (data.approved_by_id !== undefined) { updates.push(`approved_by_id = $${i++}`); values.push(data.approved_by_id); }
  if (data.approval_placeholder !== undefined) { updates.push(`approval_placeholder = $${i++}`); values.push(data.approval_placeholder); }
  if (updates.length === 0) return (await query(`SELECT * FROM governance_doctrine WHERE id = $1`, [id])).rows[0] as GovernanceDoctrineRow | null;
  updates.push('updated_at = NOW()');
  values.push(id);
  const r = await query(
    `UPDATE governance_doctrine SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return (r.rows[0] as GovernanceDoctrineRow) ?? null;
}

export async function createSectionsFromTemplate(doctrineId: string, template: Array<{ sectionNumber: string; title: string; order: number }>): Promise<number> {
  let count = 0;
  for (const s of template) {
    try {
      await query(
        `INSERT INTO doctrine_sections (governance_doctrine_id, section_number, title, content, "order", required)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [doctrineId, s.sectionNumber, s.title, '', s.order, true]
      );
      count++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code !== '23505') throw e;
    }
  }
  return count;
}

export async function createSection(
  doctrineId: string,
  sectionNumber: string,
  title: string,
  content: string,
  order: number,
  required = true
): Promise<DoctrineSectionRow | null> {
  const r = await query(
    `INSERT INTO doctrine_sections (governance_doctrine_id, section_number, title, content, "order", required)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [doctrineId, sectionNumber, title, content || null, order, required]
  );
  return (r.rows[0] as DoctrineSectionRow) ?? null;
}

export async function updateSection(
  sectionId: string,
  data: { title?: string; content?: string; order?: number; required?: boolean; copilotSuggestions?: unknown }
): Promise<DoctrineSectionRow | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.title !== undefined) { updates.push(`title = $${i++}`); values.push(data.title); }
  if (data.content !== undefined) { updates.push(`content = $${i++}`); values.push(data.content); }
  if (typeof data.order === 'number') { updates.push(`"order" = $${i++}`); values.push(data.order); }
  if (data.required !== undefined) { updates.push(`required = $${i++}`); values.push(data.required); }
  if (data.copilotSuggestions !== undefined) { updates.push(`copilot_suggestions = $${i++}::jsonb`); values.push(JSON.stringify(data.copilotSuggestions)); }
  if (updates.length === 0) return (await query(`SELECT * FROM doctrine_sections WHERE id = $1`, [sectionId])).rows[0] as DoctrineSectionRow | null;
  updates.push('updated_at = NOW()');
  values.push(sectionId);
  const r = await query(
    `UPDATE doctrine_sections SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return (r.rows[0] as DoctrineSectionRow) ?? null;
}

export async function deleteSection(sectionId: string): Promise<void> {
  await query(`DELETE FROM doctrine_sections WHERE id = $1`, [sectionId]);
}

export async function markSectionComplete(sectionId: string, userId: string, notes?: string): Promise<unknown> {
  await query(
    `INSERT INTO doctrine_completeness (doctrine_section_id, is_complete, completed_by_id, completed_at, notes)
     VALUES ($1, true, $2, NOW(), $3)
     ON CONFLICT (doctrine_section_id) DO UPDATE SET is_complete = true, completed_by_id = $2, completed_at = NOW(), notes = $3, updated_at = NOW()`,
    [sectionId, userId, notes ?? null]
  );
  return (await query(
    `SELECT * FROM doctrine_completeness WHERE doctrine_section_id = $1`,
    [sectionId]
  )).rows[0];
}

export async function getCompletenessIndex(doctrineId: string): Promise<CompletenessIndexResult> {
  const sections = (await query(
    `SELECT ds.id, ds.section_number, ds.title, ds.required, COALESCE(dc.is_complete, false) AS is_complete
     FROM doctrine_sections ds
     LEFT JOIN doctrine_completeness dc ON dc.doctrine_section_id = ds.id
     WHERE ds.governance_doctrine_id = $1 ORDER BY ds."order" ASC, ds.section_number ASC`,
    [doctrineId]
  )).rows as { id: string; section_number: string; title: string; required: boolean; is_complete: boolean }[];

  const completedSections = sections.filter((s) => s.is_complete).length;
  const totalSections = sections.length;
  const completenessPercentage = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  return {
    totalSections,
    completedSections,
    completenessPercentage,
    sections: sections.map((s) => ({
      id: s.id,
      sectionNumber: s.section_number,
      title: s.title,
      isComplete: s.is_complete,
      required: s.required
    }))
  };
}

/**
 * Build a condensed context string from all section titles and content for LLM (e.g. for doctrine suggestions).
 */
export async function getDoctrineContextForSuggestions(doctrineId: string, maxLength = 6000): Promise<string> {
  const rows = (await query(
    `SELECT section_number, title, content FROM doctrine_sections WHERE governance_doctrine_id = $1 ORDER BY "order" ASC`,
    [doctrineId]
  )).rows as { section_number: string; title: string; content: string | null }[];
  let out = '';
  for (const r of rows) {
    const block = `${r.section_number} ${r.title}\n${(r.content || '').slice(0, 800)}\n`;
    if (out.length + block.length > maxLength) break;
    out += block;
  }
  return out;
}
