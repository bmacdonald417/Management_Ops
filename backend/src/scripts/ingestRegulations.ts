#!/usr/bin/env node
/**
 * Regulatory Ingestion Script
 * Parses FAR 52 and DFARS 252 HTML, upserts into regulatory_clauses,
 * syncs to RAG (compliance_documents + compliance_chunks), and creates
 * governance_requirements for high-risk clauses.
 *
 * Local:  npm run reg:ingest  (tsx)
 * Prod:   npm run reg:ingest:prod  (node dist)
 * Railway: Set RUN_REG_INGEST=true, redeploy, then disable.
 *
 * Uses DATABASE_URL from process.env (Railway variables).
 */
import { query, pool } from '../db/connection.js';
import { loadAndParseFAR52, loadAndParseDFARS252 } from '../services/regulatoryParser.js';
import { classifyClauseRisk } from '../services/clauseRiskEngine.js';
import { upsertDocument } from '../services/complianceKB/ingest.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve regulatory HTML paths. Supports flat (part_52.html) and nested (part_52.html/part_52.html). */
function resolveRegulatoryPath(filename: string): string {
  const found = tryResolveRegulatoryPath(filename);
  if (found) return found;
  const candidates = buildCandidates(filename);
  const msg = `FATAL: Regulatory HTML not found: ${filename}. Checked:\n${candidates.map((p) => `  - ${p}`).join('\n')}`;
  console.error(msg);
  throw new Error(msg);
}

/** Prefer flat (part_52.html) over nested (part_52.html/part_52.html) so prod resolves to single file. */
function buildCandidates(filename: string): string[] {
  const bases = [
    join(process.cwd(), 'regulatory'),
    join(process.cwd(), 'dist', 'regulatory'),
    join(process.cwd(), 'backend', 'regulatory'),
    join(__dirname, '..', 'regulatory'),
    join(__dirname, '..', '..', 'regulatory'),
  ];
  const out: string[] = [];
  for (const base of bases) {
    out.push(join(base, filename));
    out.push(join(base, filename, filename));
  }
  return out;
}

function tryResolveRegulatoryPath(filename: string): string | null {
  for (const p of buildCandidates(filename)) {
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

/** DFARS may be part252.html or part_252.html (no underscore). */
function resolveDFARSPath(): string {
  const found = tryResolveRegulatoryPath('part252.html') ?? tryResolveRegulatoryPath('part_252.html');
  if (found) return found;
  const msg = `FATAL: DFARS HTML not found. Place file as regulatory/part252.html or regulatory/part_252.html`;
  console.error(msg);
  throw new Error(msg);
}

const FAR_PATH = resolveRegulatoryPath('part_52.html');
const DFARS_PATH = resolveDFARSPath();

interface IngestResult {
  inserted: number;
  skipped: number;
  farCount: number;
  dfarsCount: number;
}

async function upsertRegulatoryClause(row: {
  regulationType: string;
  part: string;
  clauseNumber: string;
  title: string;
  fullText: string;
  subpart: string | null;
  hierarchyLevel: number | null;
  riskCategory: string;
  riskScore: number;
  flowDownRequired: boolean;
}): Promise<{ id: string; isNew: boolean }> {
  const existing = (await query(
    `SELECT id FROM regulatory_clauses WHERE regulation_type = $1 AND clause_number = $2`,
    [row.regulationType, row.clauseNumber]
  )).rows[0] as { id: string } | undefined;

  if (existing) {
    await query(
      `UPDATE regulatory_clauses SET
        title = $2, full_text = $3, subpart = $4, hierarchy_level = $5,
        risk_category = $6, risk_score = $7, flow_down_required = $8, updated_at = NOW()
       WHERE id = $1`,
      [
        existing.id,
        row.title,
        row.fullText,
        row.subpart,
        row.hierarchyLevel,
        row.riskCategory,
        row.riskScore,
        row.flowDownRequired,
      ]
    );
    await upsertUnifiedClauseMaster(row);
    return { id: existing.id, isNew: false };
  }

  const r = (await query(
    `INSERT INTO regulatory_clauses (
      regulation_type, part, clause_number, title, full_text, subpart, hierarchy_level,
      risk_category, risk_score, flow_down_required
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`,
    [
      row.regulationType,
      row.part,
      row.clauseNumber,
      row.title,
      row.fullText,
      row.subpart,
      row.hierarchyLevel,
      row.riskCategory,
      row.riskScore,
      row.flowDownRequired,
    ]
  )).rows[0] as { id: string };
  await upsertUnifiedClauseMaster(row);
  return { id: r.id, isNew: true };
}

async function upsertUnifiedClauseMaster(row: {
  regulationType: string;
  clauseNumber: string;
  title: string;
  fullText: string;
  subpart: string | null;
  hierarchyLevel: number | null;
  riskCategory: string;
  riskScore: number;
  flowDownRequired: boolean;
  part: string;
}): Promise<void> {
  await query(
    `INSERT INTO unified_clause_master (
      clause_number, title, full_text, regulation, part, subpart, hierarchy_level,
      risk_category, risk_score, is_flow_down, source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ingestRegulations')
    ON CONFLICT (regulation, clause_number) DO UPDATE SET
      title = EXCLUDED.title, full_text = EXCLUDED.full_text, part = EXCLUDED.part,
      subpart = EXCLUDED.subpart, hierarchy_level = EXCLUDED.hierarchy_level,
      risk_category = EXCLUDED.risk_category, risk_score = EXCLUDED.risk_score,
      is_flow_down = EXCLUDED.is_flow_down, updated_at = NOW()`,
    [
      row.clauseNumber,
      row.title,
      row.fullText,
      row.regulationType,
      row.part,
      row.subpart,
      row.hierarchyLevel,
      row.riskCategory,
      row.riskScore,
      row.flowDownRequired
    ]
  ).catch((err) => console.warn('[ingestRegulations] unified_clause_master upsert skipped (table may not exist):', (err as Error).message));
}

async function ensureGovernanceRequirement(clauseId: string, weight: number): Promise<void> {
  const existing = (await query(
    `SELECT id FROM governance_requirements WHERE reference_id = $1 AND domain = $2`,
    [clauseId, 'Clause Risk Management']
  )).rows[0];
  if (existing) return;
  await query(
    `INSERT INTO governance_requirements (domain, weight, reference_id) VALUES ($1, $2, $3)`,
    ['Clause Risk Management', weight, clauseId]
  );
}

async function runIngestion(): Promise<IngestResult> {
  const result: IngestResult = { inserted: 0, skipped: 0, farCount: 0, dfarsCount: 0 };

  console.log('[Ingest] Loading FAR from:', FAR_PATH, 'exists:', existsSync(FAR_PATH));
  console.log('[Ingest] Loading DFARS from:', DFARS_PATH, 'exists:', existsSync(DFARS_PATH));

  const farClauses = loadAndParseFAR52(FAR_PATH);
  result.farCount = farClauses.length;
  console.log('[Ingest] FAR parsed:', result.farCount, 'clauses');

  const dfarsClauses = loadAndParseDFARS252(DFARS_PATH, (msg) => console.log('[Ingest]', msg));
  result.dfarsCount = dfarsClauses.length;
  console.log('[Ingest] DFARS parsed:', result.dfarsCount, 'clauses');

  if (result.dfarsCount > 0) {
    const sample = dfarsClauses.slice(0, 5);
    console.log('[Ingest] First 5 DFARS clauses:');
    sample.forEach((c, i) => console.log(`  ${i + 1}. ${c.clauseNumber} - ${c.title.slice(0, 60)}${c.title.length > 60 ? '...' : ''}`));
  }
  if (result.dfarsCount < 100 && process.env.SKIP_DFARS_MIN_COUNT !== 'true') {
    throw new Error(
      `DFARS parse count (${result.dfarsCount}) is below 100. Likely selector mismatch or wrong file. ` +
      'Ensure part_252.html is the full acquisition.gov DFARS Part 252 (Subpart 252.2), not PGI Part 252. ' +
      'Set SKIP_DFARS_MIN_COUNT=true to bypass during development.'
    );
  }

  const allClauses = [
    ...farClauses.map((c) => ({ ...c, regulationType: 'FAR' as const })),
    ...dfarsClauses.map((c) => ({ ...c, regulationType: 'DFARS' as const })),
  ];

  for (const clause of allClauses) {
    const risk = classifyClauseRisk(clause.clauseNumber);
    const row = {
      regulationType: clause.regulationType,
      part: clause.part,
      clauseNumber: clause.clauseNumber,
      title: clause.title,
      fullText: clause.fullText,
      subpart: clause.subpart,
      hierarchyLevel: clause.hierarchyLevel,
      riskCategory: risk.riskCategory,
      riskScore: risk.riskScore,
      flowDownRequired: risk.flowDownRequired,
    };

    const { id, isNew } = await upsertRegulatoryClause(row);
    if (isNew) result.inserted++;
    else result.skipped++;

    // Sync to RAG (ComplianceDocument + ComplianceChunk)
    const externalId = `${clause.regulationType} ${clause.clauseNumber}`;
    await upsertDocument({
      docType: 'CLAUSE',
      externalId,
      title: clause.title,
      fullText: clause.fullText,
      sourceUrl: undefined,
      meta: {
        regulationType: clause.regulationType,
        part: clause.part,
        subpart: clause.subpart,
        regulatoryClauseId: id,
      },
    });

    // Governance maturity link for riskScore >= 3
    if (risk.riskScore >= 3) {
      await ensureGovernanceRequirement(id, risk.riskScore);
    }
  }

  return result;
}

runIngestion()
  .then(async (r) => {
    console.log('[Ingest] Regulatory ingestion complete.');
    console.log('[Ingest] FAR count:', r.farCount);
    console.log('[Ingest] DFARS count:', r.dfarsCount);
    console.log('[Ingest] Inserted:', r.inserted, '| Skipped:', r.skipped);
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Ingestion failed:', err);
    await pool.end();
    process.exit(1);
  });
