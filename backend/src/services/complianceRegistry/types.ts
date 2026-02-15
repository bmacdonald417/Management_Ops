export const REGISTRY_CATEGORIES = ['FAR', 'DFARS', 'CMMC', 'NIST', 'ISO', 'INSURANCE', 'COST_ACCOUNT', 'INTERNAL'] as const;
export type RegistryCategory = typeof REGISTRY_CATEGORIES[number];

export const VALIDATION_STATUSES = ['PENDING', 'VALID', 'INVALID'] as const;
export type ValidationStatus = typeof VALIDATION_STATUSES[number];

export interface ComplianceDataSourceRow {
  id?: string;
  name: string;
  category: RegistryCategory;
  version: string;
  effectiveDate?: string;
  fileName?: string;
  recordCount?: number;
  hashFingerprint?: string;
  validationStatus: ValidationStatus;
  importedAt?: string;
  importedBy?: string;
  isActive?: boolean;
}

export interface RegistryError {
  rowIndex?: number;
  fieldName?: string;
  errorCode: string;
  errorMessage: string;
  rawValue?: string;
}

export interface ClauseMasterRow {
  clause_number: string;
  title: string;
  regulation: string;
  category?: string;
  risk_level?: number;
  flow_down?: string;
  description?: string;
  full_text?: string;
}

export interface CyberControlMasterRow {
  control_identifier: string;
  domain: string;
  level: string;
  practice_statement: string;
  objective?: string;
}

export interface CostAccountRow {
  account_code: string;
  account_name: string;
  account_type?: string;
  is_direct?: boolean;
}

export interface InsuranceTierRow {
  tier_name: string;
  min_general_liability?: number;
  min_auto?: number;
  min_professional_liability?: number;
  min_cyber?: number;
  notes?: string;
}

export interface IndemnificationTemplateRow {
  template_name: string;
  template_type?: string;
  risk_tier?: number;
  clause_text: string;
}

export const CLAUSE_CSV_HEADERS = ['clause_number', 'title', 'regulation', 'category', 'risk_level', 'flow_down', 'description', 'full_text'];
export const CYBER_CONTROL_CSV_HEADERS = ['control_identifier', 'domain', 'level', 'practice_statement', 'objective'];
export const COST_ACCOUNT_CSV_HEADERS = ['account_code', 'account_name', 'account_type', 'is_direct'];
export const INSURANCE_TIER_CSV_HEADERS = ['tier_name', 'min_general_liability', 'min_auto', 'min_professional_liability', 'min_cyber', 'notes'];
export const INDEMNIFICATION_CSV_HEADERS = ['template_name', 'template_type', 'risk_tier', 'clause_text'];
