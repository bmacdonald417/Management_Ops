export const CLAUSE_CATEGORIES = [
  'Termination', 'Changes', 'Audit/Records', 'Cyber/CUI', 'Insurance',
  'Indemnification', 'Labor', 'Small Business', 'Property', 'IP/Data Rights',
  'OCI/Ethics', 'Other'
] as const;

export const CONTRACT_TYPES = ['FFP', 'T&M', 'Cost-Reimbursable', 'IDIQ', 'BPA', 'Other'] as const;

export interface RiskWeights {
  financial: number;
  cyber: number;
  liability: number;
  regulatory: number;
  performance: number;
}

export interface RiskThresholds {
  l1_max: number;
  l2_max: number;
  l3_max: number;
  l4_min: number;
}

const DEFAULT_WEIGHTS: RiskWeights = {
  financial: 1.2,
  cyber: 1.5,
  liability: 1.3,
  regulatory: 1.0,
  performance: 1.0
};

const DEFAULT_THRESHOLDS: RiskThresholds = {
  l1_max: 10,
  l2_max: 18,
  l3_max: 25,
  l4_min: 26
};

export function computeClauseScore(
  financial: number,
  cyber: number,
  liability: number,
  regulatory: number,
  performance: number,
  weights: RiskWeights = DEFAULT_WEIGHTS
): number {
  return (
    financial * weights.financial +
    cyber * weights.cyber +
    liability * weights.liability +
    regulatory * weights.regulatory +
    performance * weights.performance
  );
}

export function scoreToRiskLevel(score: number, thresholds: RiskThresholds = DEFAULT_THRESHOLDS): number {
  if (score >= thresholds.l4_min) return 4;
  if (score > thresholds.l3_max) return 4;
  if (score > thresholds.l2_max) return 3;
  if (score > thresholds.l1_max) return 2;
  return 1;
}

export function checkClauseEscalation(
  riskLevel: number,
  category: string | null,
  dfars7012: boolean
): { escalation: boolean; reason?: string } {
  if (riskLevel >= 4) return { escalation: true, reason: 'Level 4 clause' };
  if (category === 'Indemnification' && riskLevel >= 3) return { escalation: true, reason: 'Indemnification L3+' };
  if (dfars7012) return { escalation: true, reason: 'DFARS 7012 present' };
  return { escalation: false };
}

export function computeSolicitationRisk(
  clauseEntries: { total_score: number; risk_level: number }[],
  l3Count: number,
  l4Count: number
): { overallScore: number; overallLevel: number } {
  if (clauseEntries.length === 0) return { overallScore: 0, overallLevel: 1 };
  const maxScore = Math.max(...clauseEntries.map((c) => c.total_score ?? 0), 0);
  const avgScore =
    clauseEntries.reduce((s, c) => s + (c.total_score ?? 0), 0) / clauseEntries.length;
  const overallScore = maxScore + avgScore * 0.25 + l3Count * 1 + l4Count * 3;
  const overallLevel = scoreToRiskLevel(overallScore);
  return { overallScore, overallLevel };
}

export function checkSolicitationEscalations(params: {
  overallRiskLevel: number;
  contractType: string;
  cuiInvolved: boolean;
  hasDfars7012: boolean;
  hasIndemnificationL3: boolean;
  hasAuditClause: boolean;
  l4Count: number;
  l3Count: number;
}): {
  escalationRequired: boolean;
  executiveApprovalRequired: boolean;
  qualityApprovalRequired: boolean;
  financialReviewRequired: boolean;
  cyberReviewRequired: boolean;
} {
  const {
    overallRiskLevel,
    contractType,
    cuiInvolved,
    hasDfars7012,
    hasIndemnificationL3,
    hasAuditClause,
    l4Count,
    l3Count
  } = params;

  let escalationRequired = false;
  let executiveApprovalRequired = false;
  let qualityApprovalRequired = false;
  let financialReviewRequired = false;
  let cyberReviewRequired = false;

  if (l4Count > 0) {
    escalationRequired = true;
    executiveApprovalRequired = true;
  }
  if (l3Count >= 3) escalationRequired = true;
  if (contractType === 'Cost-Reimbursable' && overallRiskLevel >= 3) escalationRequired = true;
  if (cuiInvolved || hasDfars7012) cyberReviewRequired = true;
  if (hasIndemnificationL3) escalationRequired = true;
  if (hasAuditClause && contractType !== 'FFP') financialReviewRequired = true;

  if (escalationRequired || l3Count > 0 || l4Count > 0) qualityApprovalRequired = true;

  return {
    escalationRequired,
    executiveApprovalRequired,
    qualityApprovalRequired,
    financialReviewRequired,
    cyberReviewRequired
  };
}
