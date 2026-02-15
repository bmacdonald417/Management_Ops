/**
 * Canonical clause read service.
 * Source: regulatory_clauses. Overlay: clause_library_items (optional annotations/overrides).
 */
import { query } from '../db/connection.js';

export interface ClauseFilters {
  regulationType?: 'FAR' | 'DFARS';
  riskScore?: number;
  category?: string;
  flowDown?: string;
  active?: boolean;
}

export interface ClauseWithOverlay {
  id: string;
  regulationType: string;
  regulation_type: string;
  part: string;
  clauseNumber: string;
  clause_number: string;
  title: string;
  fullText?: string;
  riskCategory: string | null;
  risk_category: string | null;
  riskScore: number | null;
  risk_score: number | null;
  flowDownRequired: boolean;
  flow_down_required: boolean;
  /** From overlay (clause_library_items) when present */
  risk_category_override?: string | null;
  risk_score_override?: number | null;
  flowdown_override?: string | null;
  notes?: string | null;
  flow_down_notes?: string | null;
  /** Overlay-only fields for legacy compat */
  type?: string;
  category?: string | null;
  suggested_risk_level?: number | null;
  default_financial?: number;
  default_cyber?: number;
  default_liability?: number;
  default_regulatory?: number;
  default_performance?: number;
  flow_down?: string;
  active?: boolean;
  hasOverlay: boolean;
}

function normalizeClauseNumber(num: string): string {
  return num.replace(/^(FAR|DFARS)\s*/i, '').replace(/\s+/g, '').trim();
}

function mergeOverlay(rc: Record<string, unknown>, overlay: Record<string, unknown> | null): ClauseWithOverlay {
  const base: ClauseWithOverlay = {
    id: rc.id as string,
    regulationType: rc.regulation_type as string,
    regulation_type: rc.regulation_type as string,
    part: (rc.part as string) ?? '',
    clauseNumber: rc.clause_number as string,
    clause_number: rc.clause_number as string,
    title: rc.title as string,
    fullText: rc.full_text as string | undefined,
    riskCategory: overlay?.category as string ?? (rc.risk_category as string) ?? null,
    risk_category: overlay?.category as string ?? (rc.risk_category as string) ?? null,
    riskScore: overlay?.suggested_risk_level != null ? (overlay.suggested_risk_level as number) : (rc.risk_score as number) ?? null,
    risk_score: overlay?.suggested_risk_level != null ? (overlay.suggested_risk_level as number) : (rc.risk_score as number) ?? null,
    flowDownRequired: overlay?.flow_down
      ? (overlay.flow_down as string) === 'YES'
      : Boolean(rc.flow_down_required),
    flow_down_required: overlay?.flow_down
      ? (overlay.flow_down as string) === 'YES'
      : Boolean(rc.flow_down_required),
    notes: (overlay?.notes as string) ?? null,
    flow_down_notes: (overlay?.flow_down_notes as string) ?? null,
    risk_category_override: overlay?.category as string ?? null,
    risk_score_override: overlay?.suggested_risk_level as number ?? null,
    flowdown_override: overlay?.flow_down as string ?? null,
    type: (overlay?.type as string) ?? (rc.regulation_type as string),
    category: (overlay?.category as string) ?? (rc.risk_category as string) ?? null,
    suggested_risk_level: overlay?.suggested_risk_level as number ?? (rc.risk_score as number) ?? null,
    default_financial: (overlay?.default_financial as number) ?? 2,
    default_cyber: (overlay?.default_cyber as number) ?? 2,
    default_liability: (overlay?.default_liability as number) ?? 2,
    default_regulatory: (overlay?.default_regulatory as number) ?? 2,
    default_performance: (overlay?.default_performance as number) ?? 2,
    flow_down: (overlay?.flow_down as string) ?? 'CONDITIONAL',
    active: overlay?.active !== false,
    hasOverlay: !!overlay
  };
  return base;
}

/**
 * Get clause by regulation type and number. Checks regulatory_clauses first, then overlay.
 */
export async function getClauseByNumber(
  regulationType: 'FAR' | 'DFARS',
  clauseNumber: string
): Promise<ClauseWithOverlay | null> {
  const num = normalizeClauseNumber(clauseNumber);
  const rc = (await query(
    `SELECT * FROM regulatory_clauses WHERE regulation_type = $1 AND clause_number = $2`,
    [regulationType, num]
  )).rows[0] as Record<string, unknown> | undefined;

  if (rc) {
    const overlay = (await query(
      `SELECT * FROM clause_library_items WHERE clause_number = $1 AND active = true`,
      [num]
    )).rows[0] as Record<string, unknown> | undefined;
    return mergeOverlay(rc, overlay ?? null);
  }

  const overlayOnly = (await query(
    `SELECT * FROM clause_library_items WHERE clause_number = $1 AND active = true`,
    [num]
  )).rows[0] as Record<string, unknown> | undefined;
  if (overlayOnly) {
    return {
      id: overlayOnly.id as string,
      regulationType: (overlayOnly.type as string) ?? 'OTHER',
      regulation_type: (overlayOnly.type as string) ?? 'OTHER',
      part: '',
      clauseNumber: overlayOnly.clause_number as string,
      clause_number: overlayOnly.clause_number as string,
      title: overlayOnly.title as string,
      riskCategory: overlayOnly.category as string ?? null,
      risk_category: overlayOnly.category as string ?? null,
      riskScore: overlayOnly.suggested_risk_level as number ?? null,
      risk_score: overlayOnly.suggested_risk_level as number ?? null,
      flowDownRequired: (overlayOnly.flow_down as string) === 'YES',
      flow_down_required: (overlayOnly.flow_down as string) === 'YES',
      notes: overlayOnly.notes as string ?? null,
      flow_down_notes: overlayOnly.flow_down_notes as string ?? null,
      type: overlayOnly.type as string,
      category: overlayOnly.category as string ?? null,
      suggested_risk_level: overlayOnly.suggested_risk_level as number ?? null,
      default_financial: (overlayOnly.default_financial as number) ?? 2,
      default_cyber: (overlayOnly.default_cyber as number) ?? 2,
      default_liability: (overlayOnly.default_liability as number) ?? 2,
      default_regulatory: (overlayOnly.default_regulatory as number) ?? 2,
      default_performance: (overlayOnly.default_performance as number) ?? 2,
      flow_down: (overlayOnly.flow_down as string) ?? 'CONDITIONAL',
      active: overlayOnly.active !== false,
      hasOverlay: true
    };
  }
  return null;
}

/**
 * Search clauses from regulatory_clauses with optional overlay. Same shape for all consumers.
 */
export async function searchClauses(
  queryStr: string,
  filters: ClauseFilters = {},
  limit = 100
): Promise<ClauseWithOverlay[]> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let i = 1;

  if (queryStr?.trim()) {
    conditions.push(`(rc.clause_number ILIKE $${i} OR rc.title ILIKE $${i})`);
    params.push(`%${queryStr.trim()}%`);
    i++;
  }
  if (filters.regulationType) {
    conditions.push(`rc.regulation_type = $${i}`);
    params.push(filters.regulationType);
    i++;
  }
  if (filters.riskScore != null) {
    conditions.push(`COALESCE(li.suggested_risk_level, rc.risk_score) = $${i}`);
    params.push(filters.riskScore);
    i++;
  }
  if (filters.category) {
    conditions.push(`COALESCE(li.category, rc.risk_category) = $${i}`);
    params.push(filters.category);
    i++;
  }
  if (filters.flowDown) {
    conditions.push(`COALESCE(li.flow_down, CASE WHEN rc.flow_down_required THEN 'YES' ELSE 'NO' END) = $${i}`);
    params.push(filters.flowDown);
    i++;
  }
  if (filters.active === false) {
    conditions.push('COALESCE(li.active, true) = false');
  } else if (filters.active === true) {
    conditions.push('COALESCE(li.active, true) = true');
  }

  const lim = Math.min(limit, 500);
  params.push(lim);

  const r = await query(
    `SELECT rc.*, li.id as overlay_id, li.category as li_category, li.suggested_risk_level as li_risk,
      li.flow_down as li_flow_down, li.notes as li_notes, li.flow_down_notes,
      li.type as li_type, li.default_financial, li.default_cyber, li.default_liability,
      li.default_regulatory, li.default_performance, li.active as li_active
     FROM regulatory_clauses rc
     LEFT JOIN clause_library_items li ON li.clause_number = rc.clause_number AND (li.active = true OR li.active IS NULL)
     WHERE ${conditions.join(' AND ')}
     ORDER BY rc.regulation_type, rc.clause_number
     LIMIT $${i}`,
    params
  );

  const rows = r.rows as Record<string, unknown>[];
  const result: ClauseWithOverlay[] = [];
  for (const row of rows) {
    const overlay = row.overlay_id
      ? {
          category: row.li_category,
          suggested_risk_level: row.li_risk,
          flow_down: row.li_flow_down,
          notes: row.li_notes,
          flow_down_notes: row.flow_down_notes,
          type: row.li_type,
          default_financial: row.default_financial,
          default_cyber: row.default_cyber,
          default_liability: row.default_liability,
          default_regulatory: row.default_regulatory,
          default_performance: row.default_performance,
          active: row.li_active
        }
      : null;
    result.push(mergeOverlay(row, overlay));
  }
  return result;
}

/**
 * Get single clause by id (regulatory_clauses.id) or clause_number, with overlay.
 */
export async function getClauseWithOverlay(idOrClauseNumber: string): Promise<ClauseWithOverlay | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrClauseNumber);

  if (isUuid) {
    const rc = (await query(`SELECT * FROM regulatory_clauses WHERE id = $1`, [idOrClauseNumber])).rows[0] as Record<string, unknown> | undefined;
    if (!rc) {
      const li = (await query(`SELECT * FROM clause_library_items WHERE id = $1`, [idOrClauseNumber])).rows[0] as Record<string, unknown> | undefined;
      if (li) {
        const num = li.clause_number as string;
        const rc2 = (await query(`SELECT * FROM regulatory_clauses WHERE clause_number = $1`, [num])).rows[0] as Record<string, unknown> | undefined;
        return mergeOverlay(rc2 ?? { id: li.id, regulation_type: li.type ?? 'OTHER', part: '', clause_number: num, title: li.title, full_text: '', risk_category: li.category, risk_score: li.suggested_risk_level, flow_down_required: (li.flow_down as string) === 'YES' }, li);
      }
      return null;
    }
    const overlay = (await query(
      `SELECT * FROM clause_library_items WHERE clause_number = $1`,
      [rc.clause_number]
    )).rows[0] as Record<string, unknown> | undefined;
    return mergeOverlay(rc, overlay ?? null);
  }

  const num = normalizeClauseNumber(idOrClauseNumber);
  const regulationType = num.startsWith('252.') ? 'DFARS' : num.startsWith('52.') ? 'FAR' : 'FAR';
  return getClauseByNumber(regulationType as 'FAR' | 'DFARS', num);
}
