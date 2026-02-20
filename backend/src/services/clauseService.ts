/**
 * Canonical clause read service.
 * Phase 1: Single source of truth is unified_clause_master (base + overlay columns).
 * Falls back to regulatory_clauses + clause_library_items when unified row is missing (e.g. before data migration).
 */
import { query } from '../db/connection.js';

export type RegulationType = 'FAR' | 'DFARS';

export interface ClauseFilters {
  regulationType?: RegulationType;
  riskScore?: number;
  category?: string;
  flowDown?: string;
  active?: boolean;
}

export interface ClauseSearchParams {
  q?: string;
  regType?: RegulationType;
  limit?: number;
  offset?: number;
  riskLevel?: number;
  flowdown?: string;
}

export interface ClauseOverlayData {
  override_risk_category?: string | null;
  override_risk_score?: number | null;
  override_flow_down_required?: boolean | null;
  override_suggested_mitigation?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  flow_down_notes?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface ClauseWithOverlayDTO {
  id: string;
  regulation_type: string;
  clause_number: string;
  part?: string;
  title: string;
  source_url?: string | null;
  full_text?: string | null;
  base_risk_category: string | null;
  base_risk_score: number | null;
  base_flow_down_required: boolean;
  overlay: ClauseOverlayData | null;
  effective_risk_category: string | null;
  effective_risk_score: number | null;
  effective_flow_down_required: boolean;
  effective_mitigation: string | null;
  tags: string[];
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;
  /** Legacy compat */
  hasOverlay: boolean;
  clauseNumber?: string;
  regulationType?: string;
  type?: string;
  riskCategory?: string | null;
  category?: string | null;
  riskScore?: number | null;
  suggested_risk_level?: number | null;
  flowDownRequired?: boolean;
  flow_down?: string;
  default_financial?: number;
  default_cyber?: number;
  default_liability?: number;
  default_regulatory?: number;
  default_performance?: number;
  active?: boolean;
}

/** Normalize clause number for matching (strip FAR/DFARS prefix, collapse whitespace) */
export function normalizeClauseNumber(input: string): string {
  return input.replace(/^(FAR|DFARS)\s*/i, '').replace(/\s+/g, ' ').trim();
}

/** Infer regulation type from clause number */
export function inferRegulationType(clauseNumber: string): RegulationType {
  const num = normalizeClauseNumber(clauseNumber);
  return num.startsWith('252.') ? 'DFARS' : 'FAR';
}

/** Map unified_clause_master row to DTO (base + overlay columns in one row) */
function unifiedRowToDTO(u: Record<string, unknown>): ClauseWithOverlayDTO {
  const baseCat = (u.risk_category as string) ?? null;
  const baseScore = (u.risk_score as number) ?? null;
  const baseFlow = Boolean(u.is_flow_down);
  const overrideCat = (u.override_risk_category as string) ?? null;
  const overrideScore = (u.override_risk_score as number) ?? null;
  const overrideFlow = u.override_flow_down_required as boolean | null | undefined;
  const effCat = overrideCat ?? baseCat;
  const effScore = overrideScore ?? baseScore;
  const effFlow = overrideFlow ?? baseFlow;
  const tagsRaw = u.overlay_tags;
  const tags = Array.isArray(tagsRaw) ? tagsRaw : (typeof tagsRaw === 'string' ? (() => { try { return JSON.parse(tagsRaw || '[]'); } catch { return []; } })() : []);
  const hasOverlay = overrideCat != null || overrideScore != null || overrideFlow != null || (u.override_suggested_mitigation as string) != null || (u.overlay_notes as string) != null;
  const overlay: ClauseOverlayData | null = hasOverlay ? {
    override_risk_category: overrideCat,
    override_risk_score: overrideScore,
    override_flow_down_required: overrideFlow ?? null,
    override_suggested_mitigation: (u.override_suggested_mitigation as string) ?? null,
    tags: tags.length ? tags : null,
    notes: (u.overlay_notes as string) ?? null,
    flow_down_notes: (u.flow_down_notes as string) ?? null,
    updated_by: (u.updated_by_id as string) ?? null,
    updated_at: (u.updated_at as string) ?? null
  } : null;
  return {
    id: u.id as string,
    regulation_type: u.regulation as string,
    part: (u.part as string) ?? '',
    clause_number: u.clause_number as string,
    clauseNumber: u.clause_number as string,
    title: u.title as string,
    source_url: null,
    full_text: (u.full_text as string) ?? null,
    base_risk_category: baseCat,
    base_risk_score: baseScore,
    base_flow_down_required: baseFlow,
    overlay,
    effective_risk_category: effCat,
    effective_risk_score: effScore,
    effective_flow_down_required: effFlow,
    effective_mitigation: (u.override_suggested_mitigation as string) ?? null,
    tags: Array.isArray(tags) ? tags : [],
    notes: (u.overlay_notes as string) ?? null,
    updated_by: (u.updated_by_id as string) ?? null,
    updated_at: (u.updated_at as string) ?? null,
    hasOverlay,
    regulationType: u.regulation as string,
    type: u.regulation as string,
    riskCategory: effCat,
    category: effCat,
    riskScore: effScore,
    suggested_risk_level: effScore,
    flowDownRequired: effFlow,
    flow_down: effFlow ? 'YES' : 'NO',
    default_financial: 2,
    default_cyber: 2,
    default_liability: 2,
    default_regulatory: 2,
    default_performance: 2,
    active: u.active !== false
  };
}

/** Legacy: build overlay from clause_library_items row */
function buildOverlay(li: Record<string, unknown> | null): ClauseOverlayData | null {
  if (!li) return null;
  const tags = li.tags;
  const tagArr = Array.isArray(tags) ? tags : (typeof tags === 'string' ? (() => { try { return JSON.parse(tags || '[]'); } catch { return []; } })() : []);
  return {
    override_risk_category: (li.override_risk_category ?? li.category) as string | null,
    override_risk_score: (li.override_risk_score ?? li.suggested_risk_level) as number | null,
    override_flow_down_required: li.override_flow_down_required != null
      ? Boolean(li.override_flow_down_required)
      : (li.flow_down === 'YES' ? true : li.flow_down === 'NO' ? false : null),
    override_suggested_mitigation: (li.override_suggested_mitigation as string) ?? null,
    tags: tagArr,
    notes: (li.notes as string) ?? null,
    flow_down_notes: (li.flow_down_notes as string) ?? null,
    updated_by: (li.updated_by as string) ?? null,
    updated_at: (li.updated_at as string) ?? null
  };
}

/** Legacy: merge regulatory_clauses row + overlay to DTO */
function mergeToDTO(rc: Record<string, unknown>, overlay: ClauseOverlayData | null): ClauseWithOverlayDTO {
  const baseCat = rc.risk_category as string ?? null;
  const baseScore = rc.risk_score as number ?? null;
  const baseFlow = Boolean(rc.flow_down_required);
  const effCat = overlay?.override_risk_category ?? baseCat;
  const effScore = overlay?.override_risk_score ?? baseScore;
  const effFlow = overlay?.override_flow_down_required ?? baseFlow;
  const effMit = overlay?.override_suggested_mitigation ?? null;
  const tags = overlay?.tags ?? [];
  const flowDownStr = overlay?.override_flow_down_required != null
    ? (overlay.override_flow_down_required ? 'YES' : 'NO')
    : (baseFlow ? 'YES' : 'NO');
  return {
    id: rc.id as string,
    regulation_type: rc.regulation_type as string,
    part: (rc.part as string) ?? '',
    clause_number: rc.clause_number as string,
    clauseNumber: rc.clause_number as string,
    title: rc.title as string,
    source_url: null,
    full_text: rc.full_text as string | undefined,
    base_risk_category: baseCat,
    base_risk_score: baseScore,
    base_flow_down_required: baseFlow,
    overlay,
    effective_risk_category: effCat,
    effective_risk_score: effScore,
    effective_flow_down_required: effFlow,
    effective_mitigation: effMit,
    tags: Array.isArray(tags) ? tags : [],
    notes: overlay?.notes ?? null,
    updated_by: overlay?.updated_by ?? null,
    updated_at: overlay?.updated_at ?? null,
    hasOverlay: !!overlay,
    regulationType: rc.regulation_type as string,
    type: rc.regulation_type as string,
    riskCategory: effCat,
    category: effCat,
    riskScore: effScore,
    suggested_risk_level: effScore,
    flowDownRequired: effFlow,
    flow_down: flowDownStr,
    default_financial: 2,
    default_cyber: 2,
    default_liability: 2,
    default_regulatory: 2,
    default_performance: 2,
    active: true
  };
}

/** Get canonical clause by regulation type and number. Prefers unified_clause_master; falls back to regulatory_clauses + overlay. */
export async function getClauseByNumber(
  regType: RegulationType,
  clauseNumber: string
): Promise<ClauseWithOverlayDTO | null> {
  const num = normalizeClauseNumber(clauseNumber);

  const unified = (await query(
    `SELECT * FROM unified_clause_master WHERE regulation = $1 AND clause_number = $2 AND (active = true OR active IS NULL)`,
    [regType, num]
  )).rows[0] as Record<string, unknown> | undefined;
  if (unified) return unifiedRowToDTO(unified);

  const rc = (await query(
    `SELECT * FROM regulatory_clauses WHERE regulation_type = $1 AND clause_number = $2`,
    [regType, num]
  )).rows[0] as Record<string, unknown> | undefined;
  if (!rc) return null;

  const overlayRow = (await query(
    `SELECT * FROM clause_library_items WHERE regulation_type = $1 AND clause_number = $2 AND (active = true OR active IS NULL)`,
    [regType, num]
  )).rows[0] as Record<string, unknown> | undefined;
  return mergeToDTO(rc, buildOverlay(overlayRow ?? null));
}

/** Search clauses. Prefers unified_clause_master; falls back to regulatory_clauses + clause_library_items. */
export async function searchClauses(
  queryStr: string,
  filters: ClauseFilters = {},
  limit = 100,
  offset = 0
): Promise<ClauseWithOverlayDTO[]> {
  const conditions: string[] = ['(u.active = true OR u.active IS NULL)'];
  const params: unknown[] = [];
  let i = 1;

  if (queryStr?.trim()) {
    conditions.push(`(u.clause_number ILIKE $${i} OR u.title ILIKE $${i})`);
    params.push(`%${queryStr.trim()}%`);
    i++;
  }
  if (filters.regulationType) {
    conditions.push(`u.regulation = $${i}`);
    params.push(filters.regulationType);
    i++;
  }
  if (filters.riskScore != null) {
    conditions.push(`(COALESCE(u.override_risk_score, u.risk_score) = $${i})`);
    params.push(filters.riskScore);
    i++;
  }
  if (filters.category) {
    conditions.push(`(COALESCE(u.override_risk_category, u.risk_category) = $${i})`);
    params.push(filters.category);
    i++;
  }
  if (filters.flowDown === 'YES' || filters.flowDown === 'NO') {
    const wantTrue = filters.flowDown === 'YES';
    conditions.push(`(COALESCE(u.override_flow_down_required, u.is_flow_down) = $${i})`);
    params.push(wantTrue);
    i++;
  }
  if (filters.active === false) {
    conditions.push('u.active = false');
  } else if (filters.active === true) {
    conditions.push('(u.active = true OR u.active IS NULL)');
  }

  const lim = Math.min(limit, 500);
  const off = Math.max(0, offset);
  params.push(lim, off);

  const r = await query(
    `SELECT * FROM unified_clause_master u
     WHERE ${conditions.join(' AND ')}
     ORDER BY u.regulation, u.clause_number
     LIMIT $${i} OFFSET $${i + 1}`,
    params
  );
  if (r.rows.length > 0) {
    return (r.rows as Record<string, unknown>[]).map(unifiedRowToDTO);
  }

  // Fallback: legacy tables
  const legConditions: string[] = ['1=1'];
  const legParams: unknown[] = [];
  let j = 1;
  if (queryStr?.trim()) {
    legConditions.push(`(rc.clause_number ILIKE $${j} OR rc.title ILIKE $${j})`);
    legParams.push(`%${queryStr.trim()}%`);
    j++;
  }
  if (filters.regulationType) {
    legConditions.push(`rc.regulation_type = $${j}`);
    legParams.push(filters.regulationType);
    j++;
  }
  if (filters.riskScore != null) {
    legConditions.push(`(COALESCE(li.override_risk_score, li.suggested_risk_level, rc.risk_score) = $${j})`);
    legParams.push(filters.riskScore);
    j++;
  }
  if (filters.category) {
    legConditions.push(`(COALESCE(li.override_risk_category, li.category, rc.risk_category) = $${j})`);
    legParams.push(filters.category);
    j++;
  }
  if (filters.flowDown === 'YES' || filters.flowDown === 'NO') {
    const wantTrue = filters.flowDown === 'YES';
    legConditions.push(`(CASE WHEN li.override_flow_down_required IS NOT NULL THEN li.override_flow_down_required WHEN li.flow_down = 'YES' THEN true WHEN li.flow_down = 'NO' THEN false ELSE rc.flow_down_required END) = $${j})`);
    legParams.push(wantTrue);
    j++;
  }
  if (filters.active === false) legConditions.push('COALESCE(li.active, true) = false');
  else if (filters.active === true) legConditions.push('COALESCE(li.active, true) = true');
  legParams.push(lim, off);

  const leg = await query(
    `SELECT rc.*, li.id as overlay_id,
      li.override_risk_category, li.override_risk_score, li.override_flow_down_required,
      li.override_suggested_mitigation, li.tags, li.notes, li.flow_down_notes,
      li.updated_by as li_updated_by, li.updated_at as li_updated_at,
      li.category as li_category, li.suggested_risk_level as li_suggested_risk_level, li.flow_down as li_flow_down
     FROM regulatory_clauses rc
     LEFT JOIN clause_library_items li ON li.regulation_type = rc.regulation_type AND li.clause_number = rc.clause_number AND (li.active = true OR li.active IS NULL)
     WHERE ${legConditions.join(' AND ')}
     ORDER BY rc.regulation_type, rc.clause_number
     LIMIT $${j} OFFSET $${j + 1}`,
    legParams
  );
  const legRows = leg.rows as Record<string, unknown>[];
  return legRows.map((row) => {
    const overlay = row.overlay_id
      ? buildOverlay({
          override_risk_category: row.override_risk_category ?? row.li_category,
          override_risk_score: row.override_risk_score ?? row.li_suggested_risk_level,
          override_flow_down_required: row.override_flow_down_required,
          flow_down: row.li_flow_down,
          override_suggested_mitigation: row.override_suggested_mitigation,
          tags: row.tags,
          notes: row.notes,
          flow_down_notes: row.flow_down_notes,
          updated_by: row.li_updated_by,
          updated_at: row.li_updated_at
        })
      : null;
    return mergeToDTO(row, overlay);
  });
}

/** Get clause by unified_clause_master id, or legacy regulatory_clauses/clause_library id, or by clause number. */
export async function getClauseWithOverlay(idOrClauseNumber: string, regType?: RegulationType): Promise<ClauseWithOverlayDTO | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrClauseNumber);

  if (isUuid) {
    const u = (await query(`SELECT * FROM unified_clause_master WHERE id = $1`, [idOrClauseNumber])).rows[0] as Record<string, unknown> | undefined;
    if (u) return unifiedRowToDTO(u);

    const rc = (await query(`SELECT * FROM regulatory_clauses WHERE id = $1`, [idOrClauseNumber])).rows[0] as Record<string, unknown> | undefined;
    if (rc) {
      const overlayRow = (await query(
        `SELECT * FROM clause_library_items WHERE regulation_type = $1 AND clause_number = $2`,
        [rc.regulation_type, rc.clause_number]
      )).rows[0] as Record<string, unknown> | undefined;
      return mergeToDTO(rc, buildOverlay(overlayRow ?? null));
    }
    const li = (await query(`SELECT * FROM clause_library_items WHERE id = $1`, [idOrClauseNumber])).rows[0] as Record<string, unknown> | undefined;
    if (li) {
      const num = normalizeClauseNumber(li.clause_number as string);
      const rt = ((li.regulation_type as string) || inferRegulationType(num)) as RegulationType;
      const u2 = (await query(`SELECT * FROM unified_clause_master WHERE regulation = $1 AND clause_number = $2`, [rt, num])).rows[0] as Record<string, unknown> | undefined;
      if (u2) return unifiedRowToDTO(u2);
      const rc2 = (await query(`SELECT * FROM regulatory_clauses WHERE regulation_type = $1 AND clause_number = $2`, [rt, num])).rows[0] as Record<string, unknown> | undefined;
      if (rc2) return mergeToDTO(rc2, buildOverlay(li));
      return null;
    }
    return null;
  }

  const num = normalizeClauseNumber(idOrClauseNumber);
  const rt = regType ?? inferRegulationType(num);
  return getClauseByNumber(rt, num);
}

/** Resolve to unified_clause_master id for (regulation, clause_number). Returns null if not found. */
export async function getUnifiedClauseMasterId(regType: RegulationType, clauseNumber: string): Promise<string | null> {
  const num = normalizeClauseNumber(clauseNumber);
  const r = await query(
    `SELECT id FROM unified_clause_master WHERE regulation = $1 AND clause_number = $2`,
    [regType, num]
  );
  const row = r.rows[0] as { id: string } | undefined;
  return row?.id ?? null;
}

/** Check if clause exists in canonical source (unified_clause_master or regulatory_clauses). */
export async function clauseExistsInRegulatory(regType: RegulationType, clauseNumber: string): Promise<boolean> {
  const num = normalizeClauseNumber(clauseNumber);
  let r = await query(
    `SELECT 1 FROM unified_clause_master WHERE regulation = $1 AND clause_number = $2`,
    [regType, num]
  );
  if (r.rows.length > 0) return true;
  r = await query(
    `SELECT 1 FROM regulatory_clauses WHERE regulation_type = $1 AND clause_number = $2`,
    [regType, num]
  );
  return r.rows.length > 0;
}

/** Resolve regulatory_clauses.id for (regulation, clause_number). Used for solicitation_clauses.clause_id when UNIQUE(solicitation_id, clause_id) is still in use. */
export async function getRegulatoryClauseId(regType: RegulationType, clauseNumber: string): Promise<string | null> {
  const num = normalizeClauseNumber(clauseNumber);
  const r = await query(
    `SELECT id FROM regulatory_clauses WHERE regulation_type = $1 AND clause_number = $2`,
    [regType, num]
  );
  const row = r.rows[0] as { id: string } | undefined;
  return row?.id ?? null;
}
