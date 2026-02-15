/**
 * Governance Engine: Solicitation Detail with Clause Review workflow.
 * Tabs: Overview, Clause Extraction, Clause Review, Approvals, Clause Risk Log.
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

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'extraction', label: 'Clause Extraction' },
  { id: 'review', label: 'Clause Review' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'risk-log', label: 'Clause Risk Log' }
];

function RiskBadgeL({ level }: { level: string }) {
  const n = level === 'L4' ? 4 : level === 'L3' ? 3 : level === 'L2' ? 2 : 1;
  return <RiskBadge level={n} size="sm" />;
}

export default function GovernanceSolicitationEngineDetail() {
  const { id } = useParams();
  const [sol, setSol] = useState<Solicitation | null>(null);
  const [tab, setTab] = useState(0);
  const [pastedText, setPastedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [blockers, setBlockers] = useState<{ ok: boolean; blockers: string[] } | null>(null);
  const [completeness, setCompleteness] = useState<{ percentComplete: number } | null>(null);
  const [riskLog, setRiskLog] = useState<Record<string, unknown> | null>(null);
  const [regulatoryClauses, setRegulatoryClauses] = useState<{ id: string; clause_number: string; title: string }[]>([]);

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

  useEffect(() => {
    if (id && tab === 4) {
      client.get(`/solicitations/${id}/risk-log/latest`).then((r) => setRiskLog(r.data)).catch(() => setRiskLog(null));
    }
  }, [id, tab]);

  useEffect(() => {
    if (id) {
      client.get(`/solicitations/${id}/approve-to-bid/blockers`).then((r) => setBlockers(r.data));
      client.get(`/solicitations/${id}/completeness`).then((r) => setCompleteness(r.data));
    }
  }, [id, sol]);

  useEffect(() => {
    client.get('/solicitations/clause-library?limit=100').then((r) => setRegulatoryClauses(r.data)).catch(() => []);
  }, []);

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

  const handleApproveToBid = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await client.post(`/solicitations/${id}/approve-to-bid`);
      load();
      if (blockers) setBlockers({ ...blockers, ok: true, blockers: [] });
    } catch (err) {
      const data = (err as { response?: { data?: { blockers?: string[] } } })?.response?.data;
      alert(data?.blockers?.join('\n') ?? (data as { error?: string })?.error ?? 'Approve failed');
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
  const canApprove = blockers?.ok ?? false;
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
            title={!canApprove && blockers ? blockers.blockers.join('; ') : ''}
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
          <ul className="list-disc list-inside">{blockers.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === i ? 'border-gov-blue text-gov-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Overview</h2>
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

      {tab === 1 && (
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
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {regulatoryClauses.slice(0, 50).map((rc) => (
                <button
                  key={rc.id}
                  onClick={() => handleManualAdd(rc.id)}
                  disabled={submitting || clauses.some((c) => c.clause_id === rc.id)}
                  className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                >
                  {rc.clause_number}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Showing first 50. Use Clause Library page to search.</p>
          </div>
        </div>
      )}

      {tab === 2 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <h3 className="p-4 font-medium">Clause Review</h3>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Clause</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Title</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Risk</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Action</th>
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
                  <td className="px-4 py-2">
                    {!c.assessment_id ? (
                      <Link to={`/governance-engine/solicitations/${id}/engine/assess/${c.id}`} className="text-gov-blue hover:underline text-sm">
                        Assess
                      </Link>
                    ) : c.assessment_status === 'SUBMITTED' ? (
                      <Link to={`/governance-engine/solicitations/${id}/engine/approve/${c.id}`} className="text-amber-600 hover:underline text-sm">
                        Approve
                      </Link>
                    ) : null}
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

      {tab === 3 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Approvals</h2>
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

      {tab === 4 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Clause Risk Log</h2>
          {riskLog ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div><div className="text-sm text-slate-500">Overall Level</div><div><RiskBadgeL level={(riskLog.overall_risk_level as string) ?? 'L1'} /></div></div>
                <div><div className="text-sm text-slate-500">Score</div><div className="text-xl font-bold">{riskLog.overall_risk_score_percent}%</div></div>
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
          <button onClick={handleGenerateRiskLog} disabled={submitting} className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
            Generate Risk Log Snapshot
          </button>
        </div>
      )}
    </div>
  );
}
