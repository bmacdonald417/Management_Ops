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

/** Parse DFARS Part 252 HTML file */
export function parseDFARS252Html(html: string): ParsedClause[] {
  const $ = cheerio.load(html);
  const clauses: ParsedClause[] = [];
  const seen = new Set<string>();

  // DFARS articles: id like DFARS_252_* or similar
  $('article[id*="252"]').each((_, el) => {
    const id = $(el).attr('id') || '';
    let clauseNum = dfarsIdToClauseNumber(id);
    if (!clauseNum) {
      // PGI 252.103 style
      const pgi = id.match(/DFARS_PGI_252\.?(\d+)/i);
      if (pgi) clauseNum = `252.${pgi[1]}`;
    }
    if (!clauseNum) return;

    const h = $(el).find('h1.title, h2.title, h3.title, h4.title').first();
    const autonum = h.find('.ph.autonumber').first().text().trim();
    let title = h.clone().children().remove().end().text().replace(autonum, '').trim() || autonum;

    const body = $(el).find('.body.conbody, .body').first();
    let fullText = body.length
      ? body.find('p').map((__, p) => $(p).text().trim()).get().filter(Boolean).join('\n\n') || body.text().trim()
      : title;

    const subpartMatch = clauseNum.match(/^252\.(\d+)/);
    const subpart = subpartMatch ? `252.${subpartMatch[1]}` : null;

    const normalized = normalizeClauseNumber(clauseNum, 'DFARS');
    if (seen.has(normalized)) return;
    seen.add(normalized);

    clauses.push({
      clauseNumber: normalized,
      regulationType: 'DFARS',
      title,
      fullText: fullText || title,
      part: '252',
      subpart,
      hierarchyLevel: 2,
    });
  });

  // TOC links
  $('a.xref.fm\\:TOC[href*="252"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const id = href.replace(/^#/, '');
    const linkText = $(el).text().trim();

    const m = linkText.match(/^(\d{3}\.\d+(?:-\d+)?)\s+(.+)$/) || linkText.match(/^PGI\s+(\d{3}\.\d+(?:\.\d+)?)\s*[-–]?\s*(.+)$/i);
    const clauseNum = m ? m[1].replace(/\.(\d+)$/, '.$1') : null;
    if (!clauseNum) return;

    const title = m ? m[2].trim() : linkText;
    const normalized = normalizeClauseNumber(clauseNum, 'DFARS');
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const article = $(`#${id.replace(/[.]/g, '\\.')}`);
    let fullText = title;
    if (article.length) {
      const body = article.find('.body.conbody, .body').first();
      if (body.length) fullText = body.find('p').map((__, p) => $(p).text().trim()).get().filter(Boolean).join('\n\n') || body.text().trim() || title;
    }

    const subpartMatch = clauseNum.match(/^252\.(\d+)/);
    const subpart = subpartMatch ? `252.${subpartMatch[1]}` : null;

    clauses.push({
      clauseNumber: normalized,
      regulationType: 'DFARS',
      title,
      fullText,
      part: '252',
      subpart,
      hierarchyLevel: 2,
    });
  });

  const byNum = new Map<string, ParsedClause>();
  for (const c of clauses) {
    if (!byNum.has(c.clauseNumber) || (c.fullText?.length ?? 0) > (byNum.get(c.clauseNumber)!.fullText?.length ?? 0)) {
      byNum.set(c.clauseNumber, c);
    }
  }
  return [...byNum.values()].sort((a, b) => a.clauseNumber.localeCompare(b.clauseNumber));
}

/** Load and parse FAR 52 from default path */
export function loadAndParseFAR52(basePath?: string): ParsedClause[] {
  const p = basePath ?? join(__dirname, '../../regulatory/part_52.html/part_52.html');
  const html = readFileSync(p, 'utf-8');
  return parseFAR52Html(html);
}

/** Load and parse DFARS 252 from default path */
export function loadAndParseDFARS252(basePath?: string): ParsedClause[] {
  const p = basePath ?? join(__dirname, '../../regulatory/part_252.html/part_252.html');
  const html = readFileSync(p, 'utf-8');
  return parseDFARS252Html(html);
}
