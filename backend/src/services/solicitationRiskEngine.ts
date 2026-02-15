/**
 * Standardized risk scoring for solicitation clause review.
 * Weighted factors (0–5 each), L1–L4 mapping, hard stops, approval tiers.
 */

export const RISK_FACTORS = {
  financial: { weight: 0.25, label: 'Financial exposure' },
  schedule: { weight: 0.15, label: 'Schedule/termination exposure' },
  audit: { weight: 0.15, label: 'Audit/DCAA exposure' },
  cyber: { weight: 0.2, label: 'Cyber/CUI exposure' },
  flowDown: { weight: 0.1, label: 'Flow-down/subcontract exposure' },
  insurance: { weight: 0.1, label: 'Insurance/indemnification exposure' },
  ip: { weight: 0.05, label: 'IP/data rights exposure' }
} as const;

export type RiskFactorScores = {
  financial?: number;
  schedule?: number;
  audit?: number;
  cyber?: number;
  flowDown?: number;
  insurance?: number;
  ip?: number;
};

const DEFAULT_WEIGHTS: Record<keyof typeof RISK_FACTORS, number> = {
  financial: 0.25,
  schedule: 0.15,
  audit: 0.15,
  cyber: 0.2,
  flowDown: 0.1,
  insurance: 0.1,
  ip: 0.05
};

const HARD_STOP_CLAUSES = [
  '252.204-7012', '252.204-7021', '52.249-2', '52.215-2',
  '252.232-7007', '52.243-1'
];

const CYBER_CMMC_PATTERNS = ['252.204-7012', '252.204-7021', '7012', '7021', 'CMMC'];
const UNLIMITED_INDEMN_PATTERNS = ['unlimited indemnification', 'unlimited liability', 'indemnify.*without limit'];

export type RiskLevel = 'L1' | 'L2' | 'L3' | 'L4';

export type ApprovalTier = 'NONE' | 'MANAGER' | 'QUALITY' | 'EXEC';

export interface RiskResult {
  riskLevel: RiskLevel;
  riskScorePercent: number;
  approvalTierRequired: ApprovalTier;
  rationale: string;
}

function normalizeClauseNumber(cn: string): string {
  return cn.replace(/^(FAR|DFARS)\s*/i, '').replace(/\s+/g, '').trim();
}

function isHardStopClause(clauseNumber: string): boolean {
  const n = normalizeClauseNumber(clauseNumber);
  return HARD_STOP_CLAUSES.some((h) => n.includes(h) || h.includes(n));
}

function isCyberCmmc(clauseNumber: string, category?: string): boolean {
  const n = normalizeClauseNumber(clauseNumber).toUpperCase();
  if (CYBER_CMMC_PATTERNS.some((p) => n.includes(p))) return true;
  if (category && /cyber|cui|cmmc/i.test(category)) return true;
  return false;
}

function isTerminationConvenience(rationale: string): boolean {
  return /termination.*convenience|T4C|T-for-C/i.test(rationale || '');
}

function isUnlimitedIndemn(rationale: string): boolean {
  return new RegExp(UNLIMITED_INDEMN_PATTERNS.join('|'), 'i').test(rationale || '');
}

/** Map raw score (0–100) to L1–L4 */
export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'L4';
  if (score >= 50) return 'L3';
  if (score >= 25) return 'L2';
  return 'L1';
}

/** Determine approval tier from risk level */
export function riskLevelToApprovalTier(level: RiskLevel): ApprovalTier {
  if (level === 'L4') return 'EXEC';
  if (level === 'L3') return 'QUALITY';
  if (level === 'L2') return 'MANAGER';
  return 'NONE';
}

/**
 * Compute risk score from factor scores (each 0–5).
 * raw = Σ(factorScore/5 * weight) * 100
 */
export function computeRiskScore(
  scores: RiskFactorScores,
  weights: Record<string, number> = DEFAULT_WEIGHTS
): number {
  const factors = Object.keys(RISK_FACTORS) as (keyof RiskFactorScores)[];
  let raw = 0;
  for (const f of factors) {
    const s = Math.max(0, Math.min(5, (scores[f] ?? 2)));
    const w = weights[f] ?? DEFAULT_WEIGHTS[f];
    raw += (s / 5) * w;
  }
  const normalized = raw / Object.values(weights).reduce((a, b) => a + b, 0);
  return Math.round(normalized * 100);
}

/**
 * Full risk assessment with hard stops and overrides.
 */
export function assessClauseRisk(params: {
  clauseNumber: string;
  scores: RiskFactorScores;
  riskCategory: string;
  rationale?: string;
  recommendedMitigation?: string;
  requiresFlowDown?: boolean;
  contractType?: string;
}): RiskResult {
  const {
    clauseNumber,
    scores,
    riskCategory,
    rationale = '',
    requiresFlowDown = false,
    contractType = ''
  } = params;

  let score = Math.min(100, Math.max(0, computeRiskScore(scores)));
  let level = scoreToRiskLevel(score);
  const reasons: string[] = [];

  // Hard stops
  if (isHardStopClause(clauseNumber)) {
    if (level === 'L1' || level === 'L2') {
      level = 'L3';
      score = Math.max(score, 50);
      reasons.push('Hard-stop clause: minimum L3');
    }
  }

  if (isCyberCmmc(clauseNumber, riskCategory)) {
    if (level === 'L1' || level === 'L2') {
      level = 'L3';
      score = Math.max(score, 50);
      reasons.push('Cyber/CMMC clause: minimum L3');
    }
  }

  if (isTerminationConvenience(rationale) && /CR|Cost-Reimbursable|T&M/i.test(contractType)) {
    level = 'L3';
    score = Math.max(score, 50);
    reasons.push('T4C + CR/T&M: minimum L3');
  }

  if (isUnlimitedIndemn(rationale)) {
    level = 'L4';
    score = Math.max(score, 75);
    reasons.push('Unlimited indemnification: minimum L4');
  }

  const approvalTier = riskLevelToApprovalTier(level);
  const rationaleText = reasons.length > 0 ? reasons.join('; ') : 'Computed from factor scores';

  return {
    riskLevel: level,
    riskScorePercent: Math.round(score),
    approvalTierRequired: approvalTier,
    rationale: rationaleText
  };
}

export function getHardStopClauses(): string[] {
  return [...HARD_STOP_CLAUSES];
}
