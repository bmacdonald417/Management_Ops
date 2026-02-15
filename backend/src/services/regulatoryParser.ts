import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type RegulationType = 'FAR' | 'DFARS';

export interface ParsedClause {
  clauseNumber: string;
  regulationType: RegulationType;
  title: string;
  fullText: string;
  part: string;
  subpart: string | null;
  hierarchyLevel: number | null;
}

/** Normalize clause number: strip FAR/DFARS, standardize dashes, canonical format (e.g. 52.249-2) */
export function normalizeClauseNumber(raw: string, regulationType: RegulationType): string {
  let s = raw
    .replace(/^(FAR|DFARS)\s*/i, '')
    .replace(/\s+/g, '')
    .trim();
  // Normalize dash: ensure format PART.SUBPART-NUMBER (e.g. 52.249-2, 252.204-7012)
  s = s.replace(/[–—]/g, '-');
  return s;
}

/** Extract clause number and title from TOC link text: "52.203-13 Contractor Code of Business Ethics and Conduct." */
function parseTocLinkText(text: string): { clauseNumber: string; title: string } | null {
  const t = text.trim();
  if (!t) return null;
  // Pattern: 52.XXX-Y or 52.XXX-YY or 252.XXX-YYYY, then title after space
  const m = t.match(/^(\d{2,3}\.\d{2,4}(?:-\d{1,4})?)\s+(.+)$/);
  if (!m) return null;
  return { clauseNumber: m[1], title: m[2].replace(/\.\s*$/, '').trim() };
}


/** FAR id pattern: FAR_52_203_13 or FAR_52_249_2 */
function farIdToClauseNumber(id: string): string | null {
  const m = id.match(/^FAR[_-]52[_-](\d+)[_-](\d+)(?:_(\d+))?$/i);
  if (!m) return null;
  const [, subpart, num, sub] = m;
  return `52.${subpart}-${num}${sub ? `-${sub}` : ''}`;
}

/** DFARS id pattern: DFARS_252_XXX_YYYY or DFARS_PGI_252.103 */
function dfarsIdToClauseNumber(id: string): string | null {
  // 252.103 (PGI style)
  const dotStyle = id.match(/252\.(\d{2,4})(?:\.(\d+))?/i);
  if (dotStyle) return `252.${dotStyle[1]}${dotStyle[2] ? `-${dotStyle[2]}` : ''}`;
  // 252_204_7012 or 252_1 (clause style)
  const m = id.match(/252[_-](\d+)(?:[_-](\d+))?(?:[_-](\d+))?/i);
  if (!m) return null;
  const [, a, b, c] = m;
  if (!b) return `252.${a}`;
  return `252.${a}-${b}${c ? `-${c}` : ''}`;
}

/** Parse FAR Part 52 HTML file */
export function parseFAR52Html(html: string): ParsedClause[] {
  const $ = cheerio.load(html);
  const clauses: ParsedClause[] = [];
  const seen = new Set<string>();

  // Method 1: Parse articles with id FAR_52_XXX_YY
  $('article[id^="FAR_52_"]').each((_, el) => {
    const id = $(el).attr('id') || '';
    const clauseNum = farIdToClauseNumber(id);
    if (!clauseNum) return;

    const h4 = $(el).find('h4.title, h3.title, h2.title').first();
    let title = '';
    const autonum = h4.find('.ph.autonumber').first().text().trim();
    const rest = h4.clone().children().remove().end().text().replace(autonum, '').trim();
    title = rest || autonum;

    const body = $(el).find('.body.conbody.clause, .body.conbody').first();
    let fullText = '';
    if (body.length) {
      fullText = body
        .find('p')
        .map((__, p) => $(p).text().trim())
        .get()
        .filter(Boolean)
        .join('\n\n');
    }
    if (!fullText && body.length) {
      fullText = body.text().trim();
    }
    if (!title) title = clauseNum;

    const subpartMatch = clauseNum.match(/^52\.(\d+)/);
    const subpart = subpartMatch ? `52.${subpartMatch[1]}` : null;
    const hierarchyLevel = 3;

    const normalized = normalizeClauseNumber(clauseNum, 'FAR');
    if (seen.has(normalized)) return;
    seen.add(normalized);

    clauses.push({
      clauseNumber: normalized,
      regulationType: 'FAR',
      title,
      fullText: fullText || title,
      part: '52',
      subpart,
      hierarchyLevel,
    });
  });

  // Method 2: TOC links for clauses we might have missed (e.g. no article body)
  $('a.xref.fm\\:TOC[href^="#FAR_52_"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const id = href.replace(/^#/, '');
    const clauseNum = farIdToClauseNumber(id);
    if (!clauseNum) return;

    const linkText = $(el).text().trim();
    const parsed = parseTocLinkText(linkText);
    const title = parsed?.title || clauseNum;
    const normalized = normalizeClauseNumber(clauseNum, 'FAR');
    if (seen.has(normalized)) return;
    seen.add(normalized);

    // Try to get full text from article if exists
    const article = $(`#${id.replace(/\./g, '\\\.')}`);
    let fullText = title;
    if (article.length) {
      const body = article.find('.body.conbody.clause, .body.conbody').first();
      if (body.length) {
        fullText = body
          .find('p')
          .map((__, p) => $(p).text().trim())
          .get()
          .filter(Boolean)
          .join('\n\n') || body.text().trim() || title;
      }
    }

    const subpartMatch = clauseNum.match(/^52\.(\d+)/);
    const subpart = subpartMatch ? `52.${subpartMatch[1]}` : null;

    clauses.push({
      clauseNumber: normalized,
      regulationType: 'FAR',
      title,
      fullText,
      part: '52',
      subpart,
      hierarchyLevel: 3,
    });
  });

  // Deduplicate by clause number (prefer article-parsed when both exist)
  const byNum = new Map<string, ParsedClause>();
  for (const c of clauses) {
    if (!byNum.has(c.clauseNumber) || c.fullText.length > (byNum.get(c.clauseNumber)!.fullText?.length ?? 0)) {
      byNum.set(c.clauseNumber, c);
    }
  }
  return [...byNum.values()].sort((a, b) => a.clauseNumber.localeCompare(b.clauseNumber));
}

/** DFARS clause pattern: 252.XXX-XXXX or 252.XXX-XXX */
const DFARS_CLAUSE_RE = /252\.(\d{3})-(\d{3,4})\s+(.+?)(?=\s*\(|\.$|$)/;

/** Extract DFARS clause from link/text: "252.204-7012 Safeguarding Covered Defense..." */
function extractDfarsClause(text: string): { clauseNumber: string; title: string } | null {
  const t = text.trim();
  const m = t.match(/^(252\.\d{3}-\d{3,4})\s+(.+)$/);
  if (!m) return null;
  const title = m[2].replace(/\.\s*$/, '').trim();
  if (title.length < 2) return null;
  return { clauseNumber: m[1], title };
}

/** Parse DFARS Part 252 HTML (acquisition.gov or PGI structure) */
export function parseDFARS252Html(html: string, log?: (msg: string) => void): ParsedClause[] {
  const $ = cheerio.load(html);
  const clauses: ParsedClause[] = [];
  const seen = new Set<string>();
  const logfn = log ?? (() => {});

  let candidateCount = 0;

  // Method 1: All links with 252.XXX-XXXX in text (acquisition.gov)
  $('a').each((_, el) => {
    const text = $(el).text().trim();
    if (!text.includes('252.')) return;
    candidateCount++;
    const parsed = extractDfarsClause(text);
    if (!parsed) return;
    const normalized = normalizeClauseNumber(parsed.clauseNumber, 'DFARS');
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const href = $(el).attr('href') || '';
    const fullTextUrl = href.startsWith('http') ? href : null;
    const fullText = fullTextUrl ? `[Full text: ${fullTextUrl}] ${parsed.title}` : parsed.title;

    const subpartMatch = parsed.clauseNumber.match(/^252\.(\d+)/);
    clauses.push({
      clauseNumber: normalized,
      regulationType: 'DFARS',
      title: parsed.title,
      fullText,
      part: '252',
      subpart: subpartMatch ? `252.${subpartMatch[1]}` : null,
      hierarchyLevel: 2,
    });
  });

  // Method 2: TOC links (PGI / dita structure)
  $('a.xref.fm\\:TOC[href*="252"], a[href*="252"]').each((_, el) => {
    const text = $(el).text().trim();
    candidateCount++;
    const parsed = extractDfarsClause(text);
    if (!parsed) {
      const pgi = text.match(/PGI\s+252\.(\d+)(?:\.(\d+))?\s*[-–]?\s*(.+)/i);
      if (pgi) {
        const clauseNum = pgi[2] ? `252.${pgi[1]}-${pgi[2]}` : `252.${pgi[1]}`;
        const normalized = normalizeClauseNumber(clauseNum, 'DFARS');
        if (!seen.has(normalized)) {
          seen.add(normalized);
          clauses.push({
            clauseNumber: normalized,
            regulationType: 'DFARS',
            title: pgi[3]?.trim() || clauseNum,
            fullText: text,
            part: '252',
            subpart: `252.${pgi[1]}`,
            hierarchyLevel: 2,
          });
        }
      }
      return;
    }
    const normalized = normalizeClauseNumber(parsed.clauseNumber, 'DFARS');
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const id = ($(el).attr('href') || '').replace(/^#/, '');
    let fullText = parsed.title;
    if (id) {
      const article = $(`#${id.replace(/[.]/g, '\\.')}`);
      if (article.length) {
        const body = article.find('.body.conbody, .body').first();
        if (body.length) fullText = body.find('p').map((__, p) => $(p).text().trim()).get().filter(Boolean).join('\n\n') || body.text().trim() || parsed.title;
      }
    }

    clauses.push({
      clauseNumber: normalized,
      regulationType: 'DFARS',
      title: parsed.title,
      fullText,
      part: '252',
      subpart: parsed.clauseNumber.match(/^252\.(\d+)/)?.[1] ? `252.${parsed.clauseNumber.match(/^252\.(\d+)/)![1]}` : null,
      hierarchyLevel: 2,
    });
  });

  // Method 3: Raw regex on HTML for acquisition.gov plain text structure
  const rawRe = /252\.(\d{3})-(\d{3,4})\s+([^<\n]+?)(?=\s*252\.|\s*$|<\/)/g;
  let rawM;
  while ((rawM = rawRe.exec(html)) !== null) {
    candidateCount++;
    const clauseNum = `252.${rawM[1]}-${rawM[2]}`;
    const title = rawM[3].trim();
    if (title.length < 2) continue;
    const normalized = normalizeClauseNumber(clauseNum, 'DFARS');
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    clauses.push({
      clauseNumber: normalized,
      regulationType: 'DFARS',
      title,
      fullText: title,
      part: '252',
      subpart: `252.${rawM[1]}`,
      hierarchyLevel: 2,
    });
  }

  // Method 4: Articles with id containing 252
  $('article[id*="252"]').each((_, el) => {
    const id = $(el).attr('id') || '';
    let clauseNum = dfarsIdToClauseNumber(id);
    if (!clauseNum) {
      const pgi = id.match(/DFARS_PGI_252\.?(\d+)/i);
      if (pgi) clauseNum = `252.${pgi[1]}`;
    }
    if (!clauseNum) return;
    candidateCount++;

    const h = $(el).find('h1.title, h2.title, h3.title, h4.title').first();
    const autonum = h.find('.ph.autonumber').first().text().trim();
    let title = h.clone().children().remove().end().text().replace(autonum, '').trim() || autonum;
    const body = $(el).find('.body.conbody, .body').first();
    let fullText = body.length ? body.find('p').map((__, p) => $(p).text().trim()).get().filter(Boolean).join('\n\n') || body.text().trim() : title;

    const normalized = normalizeClauseNumber(clauseNum, 'DFARS');
    if (seen.has(normalized)) return;
    seen.add(normalized);

    clauses.push({
      clauseNumber: normalized,
      regulationType: 'DFARS',
      title: title || clauseNum,
      fullText: fullText || title || clauseNum,
      part: '252',
      subpart: clauseNum.match(/^252\.(\d+)/)?.[1] ? `252.${clauseNum.match(/^252\.(\d+)/)![1]}` : null,
      hierarchyLevel: 2,
    });
  });

  logfn(`DFARS: ${candidateCount} candidate nodes, ${clauses.length} clauses extracted`);

  const byNum = new Map<string, ParsedClause>();
  for (const c of clauses) {
    if (!byNum.has(c.clauseNumber) || (c.fullText?.length ?? 0) > (byNum.get(c.clauseNumber)!.fullText?.length ?? 0)) {
      byNum.set(c.clauseNumber, c);
    }
  }
  const result = [...byNum.values()].sort((a, b) => a.clauseNumber.localeCompare(b.clauseNumber));
  logfn(`DFARS: ${result.length} unique clauses after dedup`);
  return result;
}

/** Load and parse FAR 52 from path */
export function loadAndParseFAR52(basePath: string): ParsedClause[] {
  const html = readFileSync(basePath, 'utf-8');
  return parseFAR52Html(html);
}

/** Load and parse DFARS 252 from path */
export function loadAndParseDFARS252(basePath: string, log?: (msg: string) => void): ParsedClause[] {
  const html = readFileSync(basePath, 'utf-8');
  return parseDFARS252Html(html, log);
}
