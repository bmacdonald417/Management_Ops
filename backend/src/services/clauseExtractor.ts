/**
 * Extract FAR/DFARS clause numbers from pasted text.
 * FAR: 52.xxx-xxxx or 52.xxx-xx
 * DFARS: 252.xxx-xxxx
 */

const FAR_PATTERN = /\b52\.\d{3}(?:-\d{2,4})?\b/gi;
const DFARS_PATTERN = /\b252\.\d{3}(?:-\d{2,4})?\b/gi;

function normalizeClauseNumber(num: string): string {
  return num.replace(/\s+/g, '').trim();
}

export interface ExtractedClause {
  clauseNumber: string;
  regulationType: 'FAR' | 'DFARS';
}

export function extractClausesFromText(text: string): ExtractedClause[] {
  const seen = new Set<string>();
  const result: ExtractedClause[] = [];

  const process = (pattern: RegExp, regulationType: 'FAR' | 'DFARS') => {
    let m: RegExpExecArray | null;
    const re = new RegExp(pattern.source, 'gi');
    while ((m = re.exec(text)) !== null) {
      const normalized = normalizeClauseNumber(m[0]);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push({ clauseNumber: normalized, regulationType });
      }
    }
  };

  process(FAR_PATTERN, 'FAR');
  process(DFARS_PATTERN, 'DFARS');

  return result.sort((a, b) => a.clauseNumber.localeCompare(b.clauseNumber));
}
