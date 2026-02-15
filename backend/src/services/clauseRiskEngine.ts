/**
 * Rule-based risk classification for FAR/DFARS clauses.
 * Applied during regulatory ingestion.
 */

export interface ClauseRiskResult {
  riskCategory: string;
  riskScore: number;
  flowDownRequired: boolean;
}

const RULES: { pattern: RegExp | string; category: string; score: number; flowDown: boolean }[] = [
  { pattern: /^52\.249/, category: 'Financial Exposure', score: 4, flowDown: false },
  { pattern: /^52\.243/, category: 'Scope Change', score: 3, flowDown: false },
  { pattern: /^52\.215/, category: 'Audit/Pricing', score: 4, flowDown: false },
  { pattern: /^52\.204-21/, category: 'Cyber', score: 4, flowDown: true },
  { pattern: /^252\.204-7012/, category: 'Cyber/CUI', score: 4, flowDown: true },
  { pattern: /^252\.204-7021/, category: 'CMMC', score: 4, flowDown: true },
  { pattern: /^52\.219/, category: 'Small Business', score: 3, flowDown: false },
  { pattern: /^52\.222/, category: 'Labor', score: 3, flowDown: false },
];

export function classifyClauseRisk(clauseNumber: string): ClauseRiskResult {
  const normalized = clauseNumber.trim().replace(/\s+/g, '');
  for (const r of RULES) {
    const matches = typeof r.pattern === 'string'
      ? normalized.startsWith(r.pattern)
      : r.pattern.test(normalized);
    if (matches) {
      return {
        riskCategory: r.category,
        riskScore: r.score,
        flowDownRequired: r.flowDown,
      };
    }
  }
  return {
    riskCategory: 'General',
    riskScore: 1,
    flowDownRequired: false,
  };
}
