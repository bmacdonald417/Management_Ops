/**
 * Governance Engine: Solicitation Detail with Clause Review workflow.
 * Stepper: Intake → Clauses → Assess → Review → Approve-to-Bid → Risk Log.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import RiskBadge from '../components/governance/RiskBadge';

interface SolicitationClause {
  id: string;
  clause_id: string;
  clause_number: string;
  title: string;
  regulation_type: string;
  risk_category: string | null;
  flow_down_required: boolean;
  assessment_id?: string;
  risk_level?: string;
  risk_score_percent?: number;
  assessment_status?: string;
  approval_tier_required?: string;
}

interface Solicitation {
  id: string;
  solicitation_number: string;
  title: string;
  agency: string;
  contract_type: string;
  status: string;
  solicitation_clauses: SolicitationClause[];
  approvals: { id: string; approval_type: string; status: string }[];
}

const STEPS = [
  { id: 'intake', label: 'Intake' },
  { id: 'clauses', label: 'Clauses' },
  { id: 'assess', label: 'Assess' },
  { id: 'review', label: 'Review' },
  { id: 'approve', label: 'Approve-to-Bid' },
  { id: 'risk-log', label: 'Risk Log' },
  { id: 'records', label: 'Records' }
];

function RiskBadgeL({ level }: { level: string }) {
  const n = level === 'L4' ? 4 : level === 'L3' ? 3 : level === 'L2' ? 2 : 1;
  return <RiskBadge level={n} size="sm" />;
}

export default function GovernanceSolicitationEngineDetail() {
  const { id } = useParams();
  const [sol, setSol] = useState<Solicitation | null>(null);
  const [step, setStep] = useState(0);
  const [pastedText, setPastedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [blockers, setBlockers] = useState<{ canApprove: boolean; blockers: { code: string; severity: string; message: string; remediation: string; actionSolicitationClauseId?: string }[] } | null>(null);
  const [completeness, setCompleteness] = useState<{ percentComplete: number } | null>(null);
  const [riskLog, setRiskLog] = useState<Record<string, unknown> | null>(null);
  const [regulatoryClauses, setRegulatoryClauses] = useState<{ id: string; clause_number: string; title: string }[]>([]);
  const [clauseSearch, setClauseSearch] = useState('');

  const load = () => {
    if (!id) return;
    client.get(`/solicitations/${id}`).then((r) => {
      setSol(r.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, [id]);

  const [formRecords, setFormRecords] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (id && step === 5) {
      client.get(`/solicitations/${id}/risk-log/latest`).then((r) => setRiskLog(r.data)).catch(() => setRiskLog(null));
    }
  }, [id, step]);

  useEffect(() => {
    if (id && step === 6) {
      client.get(`/solicitations/${id}/form-records`).then((r) => setFormRecords(r.data.records ?? [])).catch(() => setFormRecords([]));
    }
  }, [id, step]);

  useEffect(() => {
    if (id) {
      client.get(`/solicitations/${id}/approve-to-bid/blockers`).then((r) => setBlockers(r.data));
      client.get(`/solicitations/${id}/completeness`).then((r) => setCompleteness(r.data));
    }
  }, [id, sol]);

  useEffect(() => {
    const q = clauseSearch ? `&search=${encodeURIComponent(clauseSearch)}` : '';
    client.get(`/solicitations/clause-library?limit=100${q}`).then((r) => setRegulatoryClauses(r.data)).catch(() => []);
  }, [clauseSearch]);

  const handleExtract = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await client.post(`/solicitations/${id}/clauses/extract`, { pastedText });
      setPastedText('');
      load();
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Extract failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveClause = async (scId: string, skipConfirm = false) => {
    if (!id) return;
    if (!skipConfirm && !confirm('Remove this clause from the solicitation?')) return;
    setSubmitting(true);
    try {
      await client.delete(`/solicitations/${id}/clauses/${scId}`);
      load();
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Remove failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualAdd = async (clauseId: string) => {
    if (!id) return;
    setSubmitting(true);
    try {
      await client.post(`/solicitations/${id}/clauses/manual`, { clauseId });
      load();
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Add failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClauseClick = (rc: { id: string }) => {
    if (submitting) return;
    const existing = clauses.find((c) => c.clause_id === rc.id);
    if (existing) {
      handleRemoveClause(existing.id, true);
    } else {
      handleManualAdd(rc.id);
    }
  };

  const handleApproveToBid = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await client.post(`/solicitations/${id}/approve-to-bid`);
      load();
      if (blockers) setBlockers({ ...blockers, canApprove: true, blockers: [] });
    } catch (err) {
      const data = (err as { response?: { data?: { blockers?: { message: string }[]; error?: string } } })?.response?.data;
      const msg = data?.blockers?.map((b) => b.message).join('\n') ?? data?.error ?? 'Approve failed';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateRiskLog = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await client.post(`/solicitations/${id}/risk-log/generate`);
      load();
      client.get(`/solicitations/${id}/risk-log/latest`).then((r) => setRiskLog(r.data));
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Generate failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !sol) return <div className="text-slate-500">Loading...</div>;

  const hasL4 = sol.solicitation_clauses?.some((c) => c.risk_level === 'L4');
  const canApprove = blockers?.canApprove ?? false;
  const clauses = sol.solicitation_clauses ?? [];

  return (
    <div>
      <Link to="/governance-engine/solicitations" className="text-sm text-gov-blue hover:underline mb-4 inline-block">← Back to Solicitations</Link>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-gov-navy">{sol.solicitation_number}</h1>
          <p className="text-slate-500">{sol.title}</p>
        </div>
        <div className="flex items-center gap-3">
          {completeness && (
            <div className="text-right">
              <div className="text-xs text-slate-500">Completeness</div>
              <div className="text-lg font-bold text-gov-navy">{completeness.percentComplete}%</div>
            </div>
          )}
          <span className={`px-2 py-1 text-xs font-medium rounded ${sol.status === 'APPROVED_TO_BID' ? 'bg-green-100 text-green-800' : 'bg-slate-100'}`}>
            {sol.status}
          </span>
          <button
            onClick={handleApproveToBid}
            disabled={!canApprove || submitting || sol.status === 'APPROVED_TO_BID'}
            title={!canApprove && blockers ? blockers.blockers.map((b) => b.message).join('; ') : ''}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sol.status === 'APPROVED_TO_BID' ? 'Approved' : 'Approve to Bid'}
          </button>
        </div>
      </div>

      {hasL4 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 font-medium">
          Hard Stop: L4 clause(s) present. Executive approval required.
        </div>
      )}

      {!canApprove && blockers && blockers.blockers.length > 0 && sol.status !== 'APPROVED_TO_BID' && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <div className="font-medium mb-1">Cannot approve to bid until:</div>
          <ul className="list-disc list-inside space-y-1">
            {blockers.blockers.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1">
                <span className="font-medium">{b.message}</span>
                {b.remediation && <span className="text-amber-700"> — {b.remediation}</span>}
                {b.actionSolicitationClauseId && id && (
                  <Link to={`/governance-engine/solicitations/${id}/engine/assess/${b.actionSolicitationClauseId}`} className="text-gov-blue hover:underline font-medium">
                    Resolve
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <span key={s.id} className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setStep(i)}
                className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${step === i ? 'bg-gov-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {i + 1}. {s.label}
              </button>
              {i < STEPS.length - 1 && <span className="text-slate-300">→</span>}
            </span>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Intake</h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><dt className="text-slate-500 text-sm">Agency</dt><dd>{sol.agency}</dd></div>
            <div><dt className="text-slate-500 text-sm">Contract Type</dt><dd>{sol.contract_type}</dd></div>
            <div><dt className="text-slate-500 text-sm">Clauses</dt><dd>{clauses.length}</dd></div>
            <div><dt className="text-slate-500 text-sm">Completeness</dt><dd>{completeness?.percentComplete ?? 0}%</dd></div>
          </dl>
          <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gov-blue rounded-full" style={{ width: `${completeness?.percentComplete ?? 0}%` }} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-medium mb-2">Extract from Pasted Text</h3>
            <p className="text-sm text-slate-500 mb-2">Paste solicitation text; FAR (52.xxx-xxxx) and DFARS (252.xxx-xxxx) clause numbers will be extracted and matched to the Clause Library.</p>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="e.g. 52.249-2, 252.204-7012, ..."
              className="w-full h-32 px-4 py-2 border border-slate-300 rounded-lg"
            />
            <button onClick={handleExtract} disabled={submitting} className="mt-2 px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
              Extract Clauses
            </button>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-medium mb-2">Add from Clause Library</h3>
            <p className="text-sm text-slate-500 mb-2">Click to add, click again to remove.</p>
            <input
              type="text"
              placeholder="Search clause number or title…"
              value={clauseSearch}
              onChange={(e) => setClauseSearch(e.target.value)}
              className="w-full mb-2 px-4 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {regulatoryClauses.slice(0, 50).map((rc) => {
                const isAdded = clauses.some((c) => c.clause_id === rc.id);
                return (
                  <button
                    key={rc.id}
                    type="button"
                    onClick={() => handleClauseClick(rc)}
                    disabled={submitting}
                    title={isAdded ? `Click to remove ${rc.clause_number}` : `Click to add ${rc.clause_number}`}
                    className={`px-3 py-1.5 text-sm border rounded cursor-pointer transition-colors ${
                      isAdded
                        ? 'border-green-300 bg-green-50 text-green-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
                        : 'border-slate-300 hover:border-gov-blue hover:bg-gov-blue/10 hover:text-gov-navy disabled:opacity-50'
                    }`}
                  >
                    {isAdded ? `${rc.clause_number} ✓` : rc.clause_number}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">Showing first 50. Click added clauses (green) to remove them.</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <h3 className="p-4 font-medium">Clause Review</h3>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Clause</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Title</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Risk</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clauses.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-sm">{c.clause_number}</td>
                  <td className="px-4 py-2 text-sm max-w-xs truncate">{c.title}</td>
                  <td className="px-4 py-2">{c.risk_level ? <RiskBadgeL level={c.risk_level} /> : '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 text-xs rounded ${c.assessment_status === 'APPROVED' ? 'bg-green-100' : c.assessment_status === 'SUBMITTED' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                      {c.assessment_status ?? 'Not assessed'}
                    </span>
                  </td>
                  <td className="px-4 py-2 flex gap-3">
                    {!c.assessment_id ? (
                      <Link to={`/governance-engine/solicitations/${id}/engine/assess/${c.id}`} className="text-gov-blue hover:underline text-sm">
                        Assess
                      </Link>
                    ) : c.assessment_status === 'SUBMITTED' ? (
                      <Link to={`/governance-engine/solicitations/${id}/engine/approve/${c.id}`} className="text-amber-600 hover:underline text-sm">
                        Approve
                      </Link>
                    ) : (
                      <Link to={`/governance-engine/solicitations/${id}/engine/assess/${c.id}`} className="text-slate-600 hover:underline text-sm">
                        Edit
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveClause(c.id)}
                      disabled={submitting}
                      className="text-red-600 hover:underline text-sm disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clauses.length === 0 && (
            <div className="p-8 text-center text-slate-500">No clauses. Use Clause Extraction tab to extract or add from library.</div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Review</h2>
          <div className="space-y-3">
            {sol.approvals?.map((a) => (
              <div key={a.id} className="flex justify-between items-center py-2 border-b">
                <span className="font-medium">{a.approval_type}</span>
                <span className={`px-2 py-1 text-sm rounded ${a.status === 'Approved' ? 'bg-green-100' : a.status === 'Rejected' ? 'bg-red-100' : 'bg-slate-100'}`}>
                  {a.status}
                </span>
              </div>
            ))}
            {(!sol.approvals || sol.approvals.length === 0) && (
              <p className="text-slate-500">L3/L4 clause approvals appear here when assessments are submitted.</p>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Approve-to-Bid</h2>
          {sol.status === 'APPROVED_TO_BID' ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 font-medium">
              This solicitation has been approved to bid.
            </div>
          ) : (
            <>
              {!canApprove && blockers && blockers.blockers.length > 0 && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                  <div className="font-medium mb-2">Blockers</div>
                  <ul className="space-y-1">
                    {blockers.blockers.map((b, i) => (
                      <li key={i} className="flex gap-2 flex-wrap items-center">
                        <span className="font-medium">{b.message}</span>
                        <span className="text-amber-700">— {b.remediation}</span>
                        {b.actionSolicitationClauseId && id && (
                          <Link to={`/governance-engine/solicitations/${id}/engine/assess/${b.actionSolicitationClauseId}`} className="text-gov-blue hover:underline font-medium">
                            Resolve
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={handleApproveToBid}
                disabled={!canApprove || submitting}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Processing…' : 'Approve to Bid'}
              </button>
            </>
          )}
        </div>
      )}

      {step === 6 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">QMS Form Records</h2>
          {formRecords.length === 0 ? (
            <p className="text-slate-500">No form records saved to QMS yet. Save drafts or finalize from the clause assessment page.</p>
          ) : (
            <div className="space-y-3">
              {formRecords.map((r: { id?: string; templateCode?: string; status?: string; recordNumber?: string; pdfUrl?: string }) => (
                <div key={String(r.id ?? '')} className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="font-medium">{r.templateCode ?? 'MAC-FRM-013'}</span>
                    <span className="ml-2 text-slate-600">— {String(r.status ?? '')}</span>
                    {r.recordNumber && <span className="ml-2 text-gov-blue">#{r.recordNumber}</span>}
                  </div>
                  {r.pdfUrl && (
                    <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-gov-blue hover:underline text-sm">
                      Download PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Clause Risk Log</h2>
          {riskLog ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div><div className="text-sm text-slate-500">Overall Level</div><div><RiskBadgeL level={(riskLog.overall_risk_level as string) ?? 'L1'} /></div></div>
                <div><div className="text-sm text-slate-500">Score</div><div className="text-xl font-bold">{String(riskLog.overall_risk_score_percent ?? 0)}%</div></div>
                <div><div className="text-sm text-slate-500">High Risk Clauses</div><div>{String(riskLog.high_risk_clause_count ?? 0)}</div></div>
                <div><div className="text-sm text-slate-500">Generated</div><div>{new Date(riskLog.generated_at as string).toLocaleString()}</div></div>
              </div>
              <pre className="text-xs bg-slate-50 p-4 rounded overflow-auto max-h-64">
                {JSON.stringify((riskLog as { json_payload?: unknown }).json_payload ?? {}, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-slate-500 mb-4">No risk log generated yet.</p>
          )}
          <button
            onClick={handleGenerateRiskLog}
            disabled={submitting || !canApprove}
            title={!canApprove ? 'Complete all blockers before generating Risk Log' : ''}
            className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate Risk Log Snapshot
          </button>
        </div>
      )}
    </div>
  );
}
