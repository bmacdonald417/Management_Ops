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
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve regulatory HTML paths. Returns absolute path or throws. */
function resolveRegulatoryPath(relPath: string): string {
  const candidates = [
    join(__dirname, '..', relPath),
    join(__dirname, '..', '..', relPath),
    join(process.cwd(), relPath),
    join(process.cwd(), 'backend', relPath),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  const msg = `FATAL: Regulatory HTML not found. Checked paths:\n${candidates.map((p) => `  - ${p}`).join('\n')}`;
  console.error(msg);
  throw new Error(msg);
}

const FAR_PATH = resolveRegulatoryPath('regulatory/part_52.html/part_52.html');
const DFARS_PATH = resolveRegulatoryPath('regulatory/part_252.html/part_252.html');

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
  return { id: r.id, isNew: true };
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

  console.log('[Ingest] Loading FAR from:', FAR_PATH);
  console.log('[Ingest] Loading DFARS from:', DFARS_PATH);

  const farClauses = loadAndParseFAR52(FAR_PATH);
  const dfarsClauses = loadAndParseDFARS252(DFARS_PATH);
  result.farCount = farClauses.length;
  result.dfarsCount = dfarsClauses.length;
  console.log('[Ingest] Parsed FAR:', result.farCount, 'clauses, DFARS:', result.dfarsCount, 'clauses');

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
