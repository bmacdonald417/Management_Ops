/**
 * Copilot modes: RAG-backed structured outputs.
 * Each mode retrieves from compliance KB, then calls OpenAI for structured JSON.
 */

import { retrieveRelevantChunks } from '../complianceKB/retrieve.js';
import type { RetrieveResult } from '../complianceKB/types.js';
import { getOpenAIClient, getOpenAIModel } from '../../lib/openaiClient.js';
import { query } from '../../db/connection.js';

export type CopilotMode =
  | 'CLAUSE_ENRICH'
  | 'PREBID_CLAUSE_EXTRACT'
  | 'PREBID_SCORE_ASSIST'
  | 'EXECUTIVE_BRIEF'
  | 'AUTOBUILDER_SECTION_HELP';

export interface CopilotRunResult {
  success: boolean;
  result?: unknown;
  citations: { docId: string; chunkId: string; sourceUrl?: string; title?: string }[];
  error?: string;
}

export interface ClauseEnrichPayload {
  clauseNumber?: string;
  clauseId?: string;
}
export interface ClauseEnrichResult {
  suggestedType: string;
  suggestedCategory: string;
  defaultScores: { financial: number; cyber: number; liability: number; regulatory: number; performance: number };
  suggestedRiskLevel: string;
  flowDown: string;
  mitigationStrategy: string;
  notes: string;
  citations: { docId: string; chunkId: string; sourceUrl?: string }[];
}

export interface PrebidClauseExtractPayload {
  solicitationId: string;
  rawText: string;
}
export interface PrebidClauseExtractResult {
  detectedClauses: { clauseNumber: string; title: string; confidence: number }[];
  missingFromLibrary: string[];
  recommendedNextActions: string[];
  citations: { docId: string; chunkId: string; sourceUrl?: string }[];
}

export interface PrebidScoreAssistPayload {
  solicitationId: string;
  clauseEntryIds: string[];
}
export interface PrebidScoreAssistResult {
  updates: {
    clauseEntryId: string;
    scores: Record<string, number>;
    riskLevel: string;
    escalationTrigger: boolean;
    reason: string;
  }[];
  solicitationRiskSummary: { overallRiskLevel: string; flags: string[] };
  citations: { docId: string; chunkId: string; sourceUrl?: string }[];
}

export interface ExecutiveBriefPayload {
  solicitationId: string;
}
export interface ExecutiveBriefResult {
  onePager: string;
  keyRisks: string[];
  bidNoBidDraft: string;
  conditions: string[];
  citations: { docId: string; chunkId: string; sourceUrl?: string }[];
}

export interface AutobuilderSectionHelpPayload {
  sectionId: string;
  contextSnapshot?: string;
}
export interface AutobuilderSectionHelpResult {
  sectionDraft: string;
  implementationGuidance: string[];
  missingArtifacts: string[];
  citations: { docId: string; chunkId: string; sourceUrl?: string }[];
}

function citationsFromRetrieve(rows: RetrieveResult[]) {
  return rows.map((r) => ({
    docId: r.documentId,
    chunkId: r.chunkId,
    sourceUrl: r.sourceUrl,
    title: r.title
  }));
}

function buildContextFromChunks(chunks: RetrieveResult[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] (${c.externalId ?? c.title})\n${c.content}`)
    .join('\n\n---\n\n');
}

async function callOpenAIStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  jsonSchema: Record<string, unknown>
): Promise<{ result: T; raw: string } | null> {
  const client = getOpenAIClient();
  if (!client) return null;
  const completion = await client.chat.completions.create({
    model: getOpenAIModel(),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 4096
  });
  const raw = completion.choices[0]?.message?.content ?? '{}';
  try {
    const result = JSON.parse(raw) as T;
    return { result, raw };
  } catch {
    return { result: { raw } as unknown as T, raw };
  }
}

export async function runClauseEnrich(payload: ClauseEnrichPayload): Promise<CopilotRunResult> {
  let clauseNumber = payload.clauseNumber;
  if (payload.clauseId && !clauseNumber) {
    const r = (await query(
      `SELECT clause_number FROM clause_library_items WHERE id = $1`,
      [payload.clauseId]
    )).rows[0] as { clause_number?: string } | undefined;
    clauseNumber = r?.clause_number;
  }
  if (!clauseNumber) {
    return { success: false, citations: [], error: 'clauseNumber or clauseId required' };
  }

  const chunks = await retrieveRelevantChunks(
    `FAR DFARS ${clauseNumber} clause risk mitigation flow-down`,
    { docType: ['CLAUSE'], category: ['FAR', 'DFARS'] },
    10
  );
  if (chunks.length === 0) {
    return {
      success: false,
      result: { noSources: true, suggestedSteps: ['Ingest FAR/DFARS clause library via Compliance Registry', 'Run chunking and embeddings'] },
      citations: []
    };
  }

  const context = buildContextFromChunks(chunks);
  const schema = {
    suggestedType: 'FAR|DFARS|AGENCY',
    suggestedCategory: 'string',
    defaultScores: { financial: '1-5', cyber: '1-5', liability: '1-5', regulatory: '1-5', performance: '1-5' },
    suggestedRiskLevel: 'L1|L2|L3|L4',
    flowDown: 'YES|NO|CONDITIONAL',
    mitigationStrategy: 'string',
    notes: 'string',
    citations: 'array of {docId, chunkId, sourceUrl}'
  };
  const res = await callOpenAIStructured<ClauseEnrichResult>(
    'You are a federal contract governance expert. Return JSON with clause enrichment suggestions based ONLY on the provided compliance context. Use the citations from the context.',
    `Clause: ${clauseNumber}\n\nContext:\n${context}\n\nReturn JSON: ${JSON.stringify(schema)}`,
    schema as unknown as Record<string, unknown>
  );
  if (!res) return { success: false, citations: citationsFromRetrieve(chunks), error: 'AI not configured' };
  res.result.citations = citationsFromRetrieve(chunks);
  return { success: true, result: res.result, citations: citationsFromRetrieve(chunks) };
}

export async function runPrebidClauseExtract(payload: PrebidClauseExtractPayload): Promise<CopilotRunResult> {
  const text = (payload.rawText || '').slice(0, 15000);
  const chunks = await retrieveRelevantChunks(
    text || 'FAR DFARS clause identification solicitation',
    { docType: ['CLAUSE'], category: ['FAR', 'DFARS'] },
    12
  );

  const context = chunks.length > 0 ? buildContextFromChunks(chunks) : 'No clause library chunks available.';
  const schema = {
    detectedClauses: 'array of {clauseNumber, title, confidence 0-1}',
    missingFromLibrary: 'array of clause numbers not in library',
    recommendedNextActions: 'array of strings',
    citations: 'array of {docId, chunkId, sourceUrl}'
  };
  const res = await callOpenAIStructured<PrebidClauseExtractResult>(
    'Extract FAR/DFARS clause references from the solicitation text. Return JSON with detectedClauses, missingFromLibrary, recommendedNextActions. Use only provided context.',
    `Solicitation excerpt:\n${text}\n\nContext:\n${context}\n\nReturn JSON: ${JSON.stringify(schema)}`,
    schema as unknown as Record<string, unknown>
  );
  if (!res) return { success: false, citations: citationsFromRetrieve(chunks), error: 'AI not configured' };
  res.result.citations = citationsFromRetrieve(chunks);
  return { success: true, result: res.result, citations: citationsFromRetrieve(chunks) };
}

export async function runPrebidScoreAssist(payload: PrebidScoreAssistPayload): Promise<CopilotRunResult> {
  if (!payload.clauseEntryIds?.length) {
    return { success: false, citations: [], error: 'clauseEntryIds required' };
  }
  const entries = (await query(
    `SELECT id, clause_number, clause_title, financial_dim, cyber_dim, liability_dim, regulatory_dim, performance_dim, risk_level, escalation_trigger
     FROM clause_review_entries WHERE id = ANY($1)`,
    [payload.clauseEntryIds]
  )).rows as { id: string; clause_number: string; clause_title?: string }[];

  const clauseNumbers = entries.map((e) => e.clause_number).filter(Boolean).join(' ');
  const chunks = await retrieveRelevantChunks(
    `risk scoring ${clauseNumbers} FAR DFARS`,
    { docType: ['CLAUSE', 'MANUAL_SECTION'], category: ['FAR', 'DFARS', 'INTERNAL'] },
    10
  );

  const context = chunks.length > 0 ? buildContextFromChunks(chunks) : 'No context available.';
  const entriesJson = JSON.stringify(entries);
  const schema = {
    updates: 'array of {clauseEntryId, scores: {financial,cyber,liability,regulatory,performance}, riskLevel: L1-L4, escalationTrigger: boolean, reason}',
    solicitationRiskSummary: { overallRiskLevel: 'L1|L2|L3|L4', flags: 'array of strings' },
    citations: 'array'
  };
  const res = await callOpenAIStructured<PrebidScoreAssistResult>(
    'Suggest risk scores for clause entries based on compliance context. Return JSON with updates and solicitationRiskSummary.',
    `Clause entries:\n${entriesJson}\n\nContext:\n${context}\n\nReturn JSON: ${JSON.stringify(schema)}`,
    schema as unknown as Record<string, unknown>
  );
  if (!res) return { success: false, citations: citationsFromRetrieve(chunks), error: 'AI not configured' };
  res.result.updates = (res.result.updates ?? [])
    .map((u) => ({ ...u, clauseEntryId: u.clauseEntryId || entries.find((e) => e.id === u.clauseEntryId)?.id }))
    .filter((u): u is typeof u & { clauseEntryId: string } => !!u.clauseEntryId);
  res.result.citations = citationsFromRetrieve(chunks);
  return { success: true, result: res.result, citations: citationsFromRetrieve(chunks) };
}

export async function runExecutiveBrief(payload: ExecutiveBriefPayload): Promise<CopilotRunResult> {
  const sol = (await query(
    `SELECT s.*, 
      (SELECT json_agg(json_build_object('clause_number',ce.clause_number,'clause_title',ce.clause_title,'risk_level',ce.risk_level,'escalation_trigger',ce.escalation_trigger))
       FROM clause_review_entries ce JOIN solicitation_versions sv ON sv.id = ce.version_id WHERE sv.solicitation_id = s.id AND sv.version = s.current_version)
       as clause_entries
     FROM solicitations s WHERE s.id = $1`,
    [payload.solicitationId]
  )).rows[0] as { title?: string; agency?: string; contract_type?: string; cui_involved?: boolean; clause_entries?: unknown[] } | undefined;

  if (!sol) return { success: false, citations: [], error: 'Solicitation not found' };

  const summary = JSON.stringify({
    title: sol.title,
    agency: sol.agency,
    contractType: sol.contract_type,
    cuiInvolved: sol.cui_involved,
    clauseCount: Array.isArray(sol.clause_entries) ? sol.clause_entries.length : 0,
    clauses: sol.clause_entries
  });
  const chunks = await retrieveRelevantChunks(
    `executive brief bid no-bid risk assessment ${sol.title ?? ''} ${sol.agency ?? ''}`,
    { docType: ['CLAUSE', 'MANUAL_SECTION', 'POLICY'] },
    10
  );

  const context = chunks.length > 0 ? buildContextFromChunks(chunks) : 'No governance context available.';
  const schema = {
    onePager: 'markdown string',
    keyRisks: 'array of strings',
    bidNoBidDraft: 'BID|NO_BID|BID_WITH_CONDITIONS',
    conditions: 'array of strings',
    citations: 'array'
  };
  const res = await callOpenAIStructured<ExecutiveBriefResult>(
    'Generate an executive one-pager brief and bid/no-bid recommendation for this solicitation. Return JSON.',
    `Solicitation summary:\n${summary}\n\nContext:\n${context}\n\nReturn JSON: ${JSON.stringify(schema)}`,
    schema as unknown as Record<string, unknown>
  );
  if (!res) return { success: false, citations: citationsFromRetrieve(chunks), error: 'AI not configured' };
  res.result.citations = citationsFromRetrieve(chunks);
  return { success: true, result: res.result, citations: citationsFromRetrieve(chunks) };
}

export async function runAutobuilderSectionHelp(payload: AutobuilderSectionHelpPayload): Promise<CopilotRunResult> {
  const chunks = await retrieveRelevantChunks(
    `governance manual section ${payload.sectionId} ${payload.contextSnapshot ?? ''}`,
    { docType: ['MANUAL_SECTION', 'POLICY', 'SOP', 'CLAUSE'] },
    10
  );

  if (chunks.length === 0) {
    return {
      success: false,
      result: {
        noSources: true,
        sectionDraft: '',
        implementationGuidance: ['Ingest governance manual sections via Compliance Registry', 'Run chunking and embeddings'],
        missingArtifacts: [],
        citations: []
      },
      citations: []
    };
  }

  const context = buildContextFromChunks(chunks);
  const schema = {
    sectionDraft: 'markdown string',
    implementationGuidance: 'array of strings',
    missingArtifacts: 'array of strings',
    citations: 'array'
  };
  const res = await callOpenAIStructured<AutobuilderSectionHelpResult>(
    `Draft governance manual content for section ${payload.sectionId}. Return JSON.`,
    `Section: ${payload.sectionId}\nContext: ${payload.contextSnapshot ?? 'none'}\n\nReference:\n${context}\n\nReturn JSON: ${JSON.stringify(schema)}`,
    schema as unknown as Record<string, unknown>
  );
  if (!res) return { success: false, citations: citationsFromRetrieve(chunks), error: 'AI not configured' };
  res.result.citations = citationsFromRetrieve(chunks);
  return { success: true, result: res.result, citations: citationsFromRetrieve(chunks) };
}
