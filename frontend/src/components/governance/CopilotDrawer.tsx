import { useState } from 'react';
import client from '../../api/client';

export type CopilotMode =
  | 'CLAUSE_ENRICH'
  | 'PREBID_CLAUSE_EXTRACT'
  | 'PREBID_SCORE_ASSIST'
  | 'EXECUTIVE_BRIEF'
  | 'AUTOBUILDER_SECTION_HELP';

interface CopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Context passed from parent page */
  context?: {
    clauseNumber?: string;
    clauseId?: string;
    solicitationId?: string;
    clauseEntries?: { id: string; clause_number: string }[];
    sectionId?: string;
    rawText?: string;
  };
  onApplyClauseEnrich?: (clauseId: string, data: Record<string, unknown>) => void;
  onApplyScoreAssist?: (updates: { clauseEntryId: string; [k: string]: unknown }[]) => void;
  userRole?: string;
}

const MODE_LABELS: Record<CopilotMode, string> = {
  CLAUSE_ENRICH: 'Clause Enrich',
  PREBID_CLAUSE_EXTRACT: 'Extract Clauses',
  PREBID_SCORE_ASSIST: 'Score Assist',
  EXECUTIVE_BRIEF: 'Executive Brief',
  AUTOBUILDER_SECTION_HELP: 'Section Help'
};

export default function CopilotDrawer({
  open,
  onClose,
  context = {},
  onApplyClauseEnrich,
  onApplyScoreAssist,
  userRole = ''
}: CopilotDrawerProps) {
  const [mode, setMode] = useState<CopilotMode>('CLAUSE_ENRICH');
  const [rawText, setRawText] = useState(context.rawText ?? '');
  const [clauseNumber, setClauseNumber] = useState(context.clauseNumber ?? '');
  const [sectionId, setSectionId] = useState(context.sectionId ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    result?: unknown;
    citations?: { docId: string; chunkId: string; sourceUrl?: string; title?: string }[];
    error?: string;
  } | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [applying, setApplying] = useState(false);

  const canApplyEnrich = ['Level 1', 'Level 2', 'Level 3'].includes(userRole);
  const canApplyScores = ['Level 1', 'Level 2', 'Level 3'].includes(userRole);

  const runCopilot = async () => {
    setLoading(true);
    setResult(null);
    try {
      let payload: Record<string, unknown> = {};
      switch (mode) {
        case 'CLAUSE_ENRICH':
          payload = { clauseNumber: clauseNumber || context.clauseNumber, clauseId: context.clauseId };
          break;
        case 'PREBID_CLAUSE_EXTRACT':
          payload = { solicitationId: context.solicitationId ?? '00000000-0000-0000-0000-000000000000', rawText: rawText || context.rawText || '' };
          break;
        case 'PREBID_SCORE_ASSIST':
          payload = {
            solicitationId: context.solicitationId!,
            clauseEntryIds: context.clauseEntries?.map((e) => e.id) ?? []
          };
          break;
        case 'EXECUTIVE_BRIEF':
          payload = { solicitationId: context.solicitationId! };
          break;
        case 'AUTOBUILDER_SECTION_HELP':
          payload = { sectionId: sectionId || context.sectionId || '1.0', contextSnapshot: '' };
          break;
      }
      const { data } = await client.post('/copilot/run', { mode, payload });
      setAiConfigured(true);
      setResult({
        success: data.success,
        result: data.result,
        citations: data.citations ?? [],
        error: data.error
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; configured?: boolean } }; status?: number };
      setAiConfigured(err.response?.data?.configured !== false);
      setResult({
        success: false,
        error: err.response?.data?.error ?? (err.status === 503 ? 'AI not configured' : 'Request failed'),
        citations: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClauseEnrich = async () => {
    const r = result?.result as Record<string, unknown> | undefined;
    if (!r || !context.clauseId) return;
    setApplying(true);
    try {
      await client.post('/copilot/apply/clause-enrich', {
        clauseId: context.clauseId,
        suggestedType: r.suggestedType,
        suggestedCategory: r.suggestedCategory,
        defaultScores: r.defaultScores,
        suggestedRiskLevel: r.suggestedRiskLevel,
        flowDown: r.flowDown,
        mitigationStrategy: r.mitigationStrategy,
        notes: r.notes
      });
      onApplyClauseEnrich?.(context.clauseId, r);
      setResult(null);
    } finally {
      setApplying(false);
    }
  };

  const handleApplyScoreAssist = async () => {
    const r = result?.result as { updates?: { clauseEntryId: string; scores?: Record<string, number>; riskLevel?: string; escalationTrigger?: boolean }[] } | undefined;
    if (!r?.updates?.length) return;
    setApplying(true);
    try {
      const payload = r.updates.map((u) => ({
        clauseEntryId: u.clauseEntryId,
        financial_dim: u.scores?.financial,
        cyber_dim: u.scores?.cyber,
        liability_dim: u.scores?.liability,
        regulatory_dim: u.scores?.regulatory,
        performance_dim: u.scores?.performance,
        risk_level: u.riskLevel ? parseInt(String(u.riskLevel).replace('L', ''), 10) : undefined,
        escalation_trigger: u.escalationTrigger
      }));
      await client.post('/copilot/apply/score-assist', { updates: payload });
      onApplyScoreAssist?.(r.updates);
      setResult(null);
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  const res = result?.result as Record<string, unknown> | undefined;
  const citations = result?.citations ?? [];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-xl z-50 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b bg-gov-navy text-white">
          <h2 className="font-display font-semibold text-lg">Governance Copilot</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => { setMode(e.target.value as CopilotMode); setResult(null); }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {(Object.keys(MODE_LABELS) as CopilotMode[]).map((m) => (
                <option key={m} value={m}>{MODE_LABELS[m]}</option>
              ))}
            </select>
          </div>

          {mode === 'CLAUSE_ENRICH' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Clause Number</label>
              <input
                type="text"
                value={clauseNumber}
                onChange={(e) => setClauseNumber(e.target.value)}
                placeholder="e.g. FAR 52.249-2"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          )}
          {mode === 'PREBID_CLAUSE_EXTRACT' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Paste Solicitation Text</label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={6}
                placeholder="Paste excerpt from solicitation..."
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          )}
          {mode === 'AUTOBUILDER_SECTION_HELP' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Section ID</label>
              <input
                type="text"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                placeholder="e.g. 1.0, 3.1"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          )}

          {aiConfigured === false && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              Add OPENAI_API_KEY and AI_FEATURES_ENABLED in Railway → Variables, then redeploy.
            </div>
          )}

          <button
            onClick={runCopilot}
            disabled={loading
              || (mode === 'PREBID_CLAUSE_EXTRACT' && !rawText && !context.rawText)
              || (mode === 'EXECUTIVE_BRIEF' && !context.solicitationId)
              || (mode === 'PREBID_SCORE_ASSIST' && (!context.clauseEntries?.length || context.clauseEntries.length === 0))}
            className="w-full px-4 py-2 bg-gov-blue text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run'}
          </button>

          {result?.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {result.error}
            </div>
          )}

          {result && res && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gov-navy">Result</h3>
              {(res as { noSources?: boolean }).noSources ? (
                <p className="text-amber-700 text-sm">No sources found. Ingest data via Compliance Registry and run embeddings.</p>
              ) : (
                <>
                  {res.onePager && (
                    <div className="p-3 bg-slate-50 rounded-lg text-sm prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: String(res.onePager).replace(/\n/g, '<br/>') }} />
                    </div>
                  )}
                  {res.sectionDraft && (
                    <div className="p-3 bg-slate-50 rounded-lg text-sm prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: String(res.sectionDraft).replace(/\n/g, '<br/>') }} />
                    </div>
                  )}
                  {res.suggestedType && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span>Type:</span><span>{String(res.suggestedType)}</span>
                      <span>Category:</span><span>{String(res.suggestedCategory)}</span>
                      <span>Risk:</span><span>{String(res.suggestedRiskLevel)}</span>
                      <span>Flow-down:</span><span>{String(res.flowDown)}</span>
                      {res.defaultScores ? (
                        <>
                          <span>Scores:</span>
                          <span>{JSON.stringify(res.defaultScores)}</span>
                        </>
                      ) : null}
                    </div>
                  )}
                  {Array.isArray(res.detectedClauses) && res.detectedClauses.length > 0 && (
                    <ul className="text-sm space-y-1">
                      {res.detectedClauses.map((c: { clauseNumber: string; title: string }, i: number) => (
                        <li key={i}><strong>{c.clauseNumber}</strong> {c.title}</li>
                      ))}
                    </ul>
                  )}
                  {Array.isArray(res.updates) && res.updates.length > 0 && (
                    <div className="text-sm">
                      <p className="font-medium mb-1">Suggested score updates:</p>
                      <ul className="space-y-1">
                        {res.updates.slice(0, 5).map((u: { clauseEntryId: string; scores?: Record<string, number> }, i: number) => (
                          <li key={i}>{u.clauseEntryId.slice(0, 8)}... → {JSON.stringify(u.scores)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(res.keyRisks) && res.keyRisks.length > 0 && (
                    <ul className="text-sm list-disc pl-4">
                      {res.keyRisks.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {res.bidNoBidDraft && (
                    <p className="text-sm"><strong>Recommendation:</strong> {String(res.bidNoBidDraft)}</p>
                  )}

                  {mode === 'CLAUSE_ENRICH' && context.clauseId && canApplyEnrich && (
                    <button
                      onClick={handleApplyClauseEnrich}
                      disabled={applying}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {applying ? 'Applying...' : 'Apply to Clause'}
                    </button>
                  )}
                  {mode === 'PREBID_SCORE_ASSIST' && Array.isArray(res.updates) && res.updates.length > 0 && canApplyScores && (
                    <button
                      onClick={handleApplyScoreAssist}
                      disabled={applying}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {applying ? 'Applying...' : 'Apply Scores'}
                    </button>
                  )}
                </>
              )}

              {citations.length > 0 && (
                <div className="border-t pt-3">
                  <h4 className="text-sm font-medium text-slate-600 mb-1">Citations</h4>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                    {citations.map((c, i) => (
                      <li key={i}>
                        <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gov-blue hover:underline">
                          {c.title || c.chunkId?.slice(0, 8)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
