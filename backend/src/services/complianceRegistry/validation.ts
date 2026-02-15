import type { RegistryError } from './types.js';
import {
  CLAUSE_CSV_HEADERS,
  CYBER_CONTROL_CSV_HEADERS,
  COST_ACCOUNT_CSV_HEADERS,
  INSURANCE_TIER_CSV_HEADERS,
  INDEMNIFICATION_CSV_HEADERS,
  type RegistryCategory
} from './types.js';

const UTF8_BOM = '\uFEFF';
const VALID_UTF8_REGEX = /^[\u0000-\uFFFF]*$/;

export function validateUtf8(content: string): RegistryError | null {
  const clean = content.replace(UTF8_BOM, '');
  if (!VALID_UTF8_REGEX.test(clean)) {
    return { errorCode: 'INVALID_UTF8', errorMessage: 'Content contains invalid UTF-8 characters' };
  }
  return null;
}

export function validateRiskLevel(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = typeof val === 'number' ? val : parseInt(String(val).trim(), 10);
  if (isNaN(n) || n < 1 || n > 4) return null;
  return n;
}

function normalizeHeader(h: string): string {
  return h.replace(UTF8_BOM, '').trim().toLowerCase().replace(/\s+/g, '_');
}

function headerMatch(required: string[], actual: string[]): { ok: boolean; missing: string[] } {
  const normalized = actual.map(normalizeHeader);
  const requiredNorm = required.map((r) => r.toLowerCase());
  const missing = requiredNorm.filter((r) => !normalized.includes(r));
  return { ok: missing.length === 0, missing };
}

export function validateCsvHeaders(
  headers: string[],
  category: RegistryCategory
): RegistryError | null {
  let required: string[];
  switch (category) {
    case 'FAR':
    case 'DFARS':
    case 'INTERNAL':
      required = CLAUSE_CSV_HEADERS.slice(0, 4); // clause_number, title, regulation required; category optional
      break;
    case 'CMMC':
    case 'NIST':
      required = CYBER_CONTROL_CSV_HEADERS.slice(0, 4);
      break;
    case 'COST_ACCOUNT':
      required = COST_ACCOUNT_CSV_HEADERS.slice(0, 2);
      break;
    case 'INSURANCE':
      required = INSURANCE_TIER_CSV_HEADERS.slice(0, 1);
      break;
    case 'ISO':
      required = INDEMNIFICATION_CSV_HEADERS.slice(0, 2);
      break;
    default:
      required = ['clause_number', 'title', 'regulation'];
  }
  const { ok, missing } = headerMatch(required, headers);
  if (!ok) {
    return {
      errorCode: 'HEADER_MISMATCH',
      errorMessage: `Required headers missing: ${missing.join(', ')}`,
      rawValue: headers.join(', ')
    };
  }
  return null;
}

export function validateClauseRow(
  row: Record<string, unknown>,
  rowIndex: number,
  existingClauseNumbers: Set<string>
): RegistryError[] {
  const errs: RegistryError[] = [];
  const cn = String(row.clause_number ?? '').trim();
  if (!cn) {
    errs.push({ rowIndex, fieldName: 'clause_number', errorCode: 'REQUIRED', errorMessage: 'clause_number is required', rawValue: String(row.clause_number) });
  }
  const title = String(row.title ?? '').trim();
  if (!title) {
    errs.push({ rowIndex, fieldName: 'title', errorCode: 'REQUIRED', errorMessage: 'title is required', rawValue: String(row.title) });
  }
  const reg = String(row.regulation ?? '').trim();
  if (!reg) {
    errs.push({ rowIndex, fieldName: 'regulation', errorCode: 'REQUIRED', errorMessage: 'regulation is required', rawValue: String(row.regulation) });
  }
  const rl = validateRiskLevel(row.risk_level);
  if (row.risk_level !== undefined && row.risk_level !== null && row.risk_level !== '' && rl === null) {
    errs.push({ rowIndex, fieldName: 'risk_level', errorCode: 'INVALID_RISK_LEVEL', errorMessage: 'risk_level must be 1-4', rawValue: String(row.risk_level) });
  }
  if (cn && existingClauseNumbers.has(cn)) {
    errs.push({ rowIndex, fieldName: 'clause_number', errorCode: 'DUPLICATE', errorMessage: 'Duplicate clause_number in file', rawValue: cn });
  }
  if (cn) existingClauseNumbers.add(cn);
  return errs;
}

export function validateCyberControlRow(row: Record<string, unknown>, rowIndex: number): RegistryError[] {
  const errs: RegistryError[] = [];
  const id = String(row.control_identifier ?? '').trim();
  if (!id) errs.push({ rowIndex, fieldName: 'control_identifier', errorCode: 'REQUIRED', errorMessage: 'control_identifier is required', rawValue: String(row.control_identifier) });
  const domain = String(row.domain ?? '').trim();
  if (!domain) errs.push({ rowIndex, fieldName: 'domain', errorCode: 'REQUIRED', errorMessage: 'domain is required', rawValue: String(row.domain) });
  const level = String(row.level ?? '').trim();
  if (!level) errs.push({ rowIndex, fieldName: 'level', errorCode: 'REQUIRED', errorMessage: 'level is required', rawValue: String(row.level) });
  const ps = String(row.practice_statement ?? '').trim();
  if (!ps) errs.push({ rowIndex, fieldName: 'practice_statement', errorCode: 'REQUIRED', errorMessage: 'practice_statement is required', rawValue: String(row.practice_statement) });
  return errs;
}

export function validateCostAccountRow(row: Record<string, unknown>, rowIndex: number): RegistryError[] {
  const errs: RegistryError[] = [];
  const code = String(row.account_code ?? '').trim();
  if (!code) errs.push({ rowIndex, fieldName: 'account_code', errorCode: 'REQUIRED', errorMessage: 'account_code is required', rawValue: String(row.account_code) });
  const name = String(row.account_name ?? '').trim();
  if (!name) errs.push({ rowIndex, fieldName: 'account_name', errorCode: 'REQUIRED', errorMessage: 'account_name is required', rawValue: String(row.account_name) });
  return errs;
}

export function validateInsuranceTierRow(row: Record<string, unknown>, rowIndex: number): RegistryError[] {
  const errs: RegistryError[] = [];
  const tier = String(row.tier_name ?? '').trim();
  if (!tier) errs.push({ rowIndex, fieldName: 'tier_name', errorCode: 'REQUIRED', errorMessage: 'tier_name is required', rawValue: String(row.tier_name) });
  return errs;
}

export function validateIndemnificationRow(row: Record<string, unknown>, rowIndex: number): RegistryError[] {
  const errs: RegistryError[] = [];
  const name = String(row.template_name ?? '').trim();
  if (!name) errs.push({ rowIndex, fieldName: 'template_name', errorCode: 'REQUIRED', errorMessage: 'template_name is required', rawValue: String(row.template_name) });
  const text = String(row.clause_text ?? '').trim();
  if (!text) errs.push({ rowIndex, fieldName: 'clause_text', errorCode: 'REQUIRED', errorMessage: 'clause_text is required', rawValue: String(row.clause_text) });
  const rt = validateRiskLevel(row.risk_tier);
  if (row.risk_tier !== undefined && row.risk_tier !== null && row.risk_tier !== '' && rt === null) {
    errs.push({ rowIndex, fieldName: 'risk_tier', errorCode: 'INVALID_RISK_LEVEL', errorMessage: 'risk_tier must be 1-4', rawValue: String(row.risk_tier) });
  }
  return errs;
}
