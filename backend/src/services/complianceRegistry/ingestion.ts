import { parse } from 'csv-parse/sync';
import { createHash } from 'crypto';
import { query } from '../../db/connection.js';
import type { RegistryCategory, RegistryError } from './types.js';
import {
  validateUtf8,
  validateCsvHeaders,
  validateClauseRow,
  validateCyberControlRow,
  validateCostAccountRow,
  validateInsuranceTierRow,
  validateIndemnificationRow,
  validateRiskLevel
} from './validation.js';

export interface IngestResult {
  dataSourceId: string;
  recordCount: number;
  validationStatus: 'VALID' | 'INVALID';
  errors: RegistryError[];
}

function computeFingerprint(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = content.replace(/\uFEFF/g, '');
  const parsed = parse(clean, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  }) as Record<string, string>[];
  const headers = parsed.length > 0 ? Object.keys(parsed[0]) : [];
  return { headers, rows: parsed };
}

function normalizeKey(k: string): string {
  return k.replace(/\uFEFF/g, '').trim().toLowerCase().replace(/\s+/g, '_');
}

function toRecord(row: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = v?.trim?.() ?? v;
  }
  return out;
}

export async function ingestCsv(
  content: string,
  fileName: string,
  category: RegistryCategory,
  version: string,
  name: string,
  effectiveDate: string | undefined,
  userId: string
): Promise<IngestResult> {
  const errors: RegistryError[] = [];

  const utf8Err = validateUtf8(content);
  if (utf8Err) {
    errors.push(utf8Err);
    const insRows = (await query(
      `INSERT INTO compliance_data_sources (name, category, version, effective_date, file_name, record_count, validation_status, imported_by)
       VALUES ($1, $2, $3, $4, $5, 0, 'INVALID', $6) RETURNING id`,
      [name, category, version, effectiveDate || null, fileName, userId]
    )).rows as { id: string }[];
    const dataSourceId = insRows[0]?.id ?? '';
    if (dataSourceId) await saveErrors(dataSourceId, errors);
    return { dataSourceId: dataSourceId ?? '', recordCount: 0, validationStatus: 'INVALID', errors };
  }

  const { headers, rows } = parseCsv(content);
  const headerErr = validateCsvHeaders(headers, category);
  if (headerErr) {
    errors.push(headerErr);
    const [ds2] = (await query(
      `INSERT INTO compliance_data_sources (name, category, version, effective_date, file_name, record_count, validation_status, imported_by)
       VALUES ($1, $2, $3, $4, $5, 0, 'INVALID', $6) RETURNING id`,
      [name, category, version, effectiveDate || null, fileName, userId]
    )).rows as { id: string }[];
    const dataSourceId2 = (ds2 as { id: string })?.id;
    if (dataSourceId2) await saveErrors(dataSourceId2, errors);
    return { dataSourceId: dataSourceId2 ?? '', recordCount: 0, validationStatus: 'INVALID', errors };
  }

  const records = rows.map((r) => toRecord(r));
  const existingInFile = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    let rowErrs: RegistryError[] = [];
    switch (category) {
      case 'FAR':
      case 'DFARS':
      case 'INTERNAL':
        rowErrs = validateClauseRow(row, i + 2, existingInFile);
        break;
      case 'CMMC':
      case 'NIST':
        rowErrs = validateCyberControlRow(row, i + 2);
        break;
      case 'COST_ACCOUNT':
        rowErrs = validateCostAccountRow(row, i + 2);
        break;
      case 'INSURANCE':
        rowErrs = validateInsuranceTierRow(row, i + 2);
        break;
      case 'ISO':
        rowErrs = validateIndemnificationRow(row, i + 2);
        break;
      default:
        rowErrs = validateClauseRow(row, i + 2, existingInFile);
    }
    errors.push(...rowErrs);
  }

  const fingerprint = computeFingerprint(content);
  const rowsResult = (await query(
    `INSERT INTO compliance_data_sources (name, category, version, effective_date, file_name, record_count, hash_fingerprint, validation_status, imported_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [name, category, version, effectiveDate || null, fileName, records.length, fingerprint, errors.length > 0 ? 'INVALID' : 'VALID', userId]
  )).rows as { id: string }[];
  const dataSourceId = rowsResult[0]?.id ?? '';

  if (errors.length > 0) {
    await saveErrors(dataSourceId, errors);
    return { dataSourceId, recordCount: records.length, validationStatus: 'INVALID', errors };
  }

  switch (category) {
    case 'FAR':
    case 'DFARS':
    case 'INTERNAL':
      await insertClauseMaster(dataSourceId, records);
      break;
    case 'CMMC':
    case 'NIST':
      await insertCyberControlMaster(dataSourceId, records);
      break;
    case 'COST_ACCOUNT':
      await insertCostAccounts(dataSourceId, records);
      break;
    case 'INSURANCE':
      await insertInsuranceTiers(dataSourceId, records);
      break;
    case 'ISO':
      await insertIndemnificationTemplates(dataSourceId, records);
      break;
    default:
      await insertClauseMaster(dataSourceId, records);
  }

  await setActiveVersion(category, dataSourceId);

  return { dataSourceId, recordCount: records.length, validationStatus: 'VALID', errors: [] };
}

async function saveErrors(dataSourceId: string, errors: RegistryError[]): Promise<void> {
  for (const e of errors.slice(0, 500)) {
    await query(
      `INSERT INTO compliance_registry_errors (data_source_id, row_index, field_name, error_code, error_message, raw_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [dataSourceId, e.rowIndex ?? null, e.fieldName ?? null, e.errorCode, e.errorMessage, e.rawValue ?? null]
    );
  }
}

async function insertClauseMaster(dataSourceId: string, records: Record<string, unknown>[]): Promise<void> {
  const reg = records[0] ? String((records[0] as Record<string, unknown>).regulation ?? 'FAR') : 'FAR';
  for (const r of records) {
    const cn = String(r.clause_number ?? '').trim();
    const title = String(r.title ?? '').trim();
    const regulation = String(r.regulation ?? reg).trim();
    const category = r.category ? String(r.category).trim() : null;
    const rl = validateRiskLevel(r.risk_level);
    const fd = r.flow_down ? String(r.flow_down).trim() : 'CONDITIONAL';
    const desc = r.description ? String(r.description).trim() : null;
    const full = r.full_text ? String(r.full_text).trim() : null;
    await query(
      `INSERT INTO clause_master (data_source_id, clause_number, title, regulation, category, risk_level, flow_down, description, full_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (data_source_id, clause_number) DO UPDATE SET title = EXCLUDED.title, regulation = EXCLUDED.regulation, category = EXCLUDED.category, risk_level = EXCLUDED.risk_level, flow_down = EXCLUDED.flow_down, description = EXCLUDED.description, full_text = EXCLUDED.full_text`,
      [dataSourceId, cn, title, regulation, category, rl, fd, desc, full]
    );
  }
}

async function insertCyberControlMaster(dataSourceId: string, records: Record<string, unknown>[]): Promise<void> {
  for (const r of records) {
    const id = String(r.control_identifier ?? '').trim();
    const domain = String(r.domain ?? '').trim();
    const level = String(r.level ?? '').trim();
    const ps = String(r.practice_statement ?? '').trim();
    const obj = r.objective ? String(r.objective).trim() : null;
    await query(
      `INSERT INTO cyber_control_master (data_source_id, control_identifier, domain, level, practice_statement, objective)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (data_source_id, control_identifier) DO UPDATE SET domain = EXCLUDED.domain, level = EXCLUDED.level, practice_statement = EXCLUDED.practice_statement, objective = EXCLUDED.objective`,
      [dataSourceId, id, domain, level, ps, obj]
    );
  }
}

async function insertCostAccounts(dataSourceId: string, records: Record<string, unknown>[]): Promise<void> {
  for (const r of records) {
    const code = String(r.account_code ?? '').trim();
    const name = String(r.account_name ?? '').trim();
    const type = r.account_type ? String(r.account_type).trim() : null;
    const direct = r.is_direct !== undefined && r.is_direct !== null && String(r.is_direct).toLowerCase() !== 'false';
    await query(
      `INSERT INTO cost_accounts (data_source_id, account_code, account_name, account_type, is_direct)
       VALUES ($1, $2, $3, $4, $5)`,
      [dataSourceId, code, name, type, direct]
    );
  }
}

async function insertInsuranceTiers(dataSourceId: string, records: Record<string, unknown>[]): Promise<void> {
  for (const r of records) {
    const tier = String(r.tier_name ?? '').trim();
    const gl = r.min_general_liability != null ? parseFloat(String(r.min_general_liability)) : null;
    const auto = r.min_auto != null ? parseFloat(String(r.min_auto)) : null;
    const prof = r.min_professional_liability != null ? parseFloat(String(r.min_professional_liability)) : null;
    const cyber = r.min_cyber != null ? parseFloat(String(r.min_cyber)) : null;
    const notes = r.notes ? String(r.notes).trim() : null;
    await query(
      `INSERT INTO insurance_tiers (data_source_id, tier_name, min_general_liability, min_auto, min_professional_liability, min_cyber, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [dataSourceId, tier, gl, auto, prof, cyber, notes]
    );
  }
}

async function insertIndemnificationTemplates(dataSourceId: string, records: Record<string, unknown>[]): Promise<void> {
  for (const r of records) {
    const name = String(r.template_name ?? '').trim();
    const type = r.template_type ? String(r.template_type).trim() : null;
    const rt = validateRiskLevel(r.risk_tier);
    const text = String(r.clause_text ?? '').trim();
    await query(
      `INSERT INTO indemnification_templates (data_source_id, template_name, template_type, risk_tier, clause_text)
       VALUES ($1, $2, $3, $4, $5)`,
      [dataSourceId, name, type, rt, text]
    );
  }
}

export async function setActiveVersion(category: RegistryCategory, dataSourceId: string): Promise<void> {
  await query(`UPDATE compliance_data_sources SET is_active = false WHERE category = $1`, [category]);
  await query(`UPDATE compliance_data_sources SET is_active = true WHERE id = $1`, [dataSourceId]);
}
