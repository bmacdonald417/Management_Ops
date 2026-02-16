/**
 * Assess a solicitation clause with factor scores (0-5 each).
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';

const FACTORS = [
  { key: 'financial', label: 'Financial exposure' },
  { key: 'schedule', label: 'Schedule/termination' },
  { key: 'audit', label: 'Audit/DCAA' },
  { key: 'cyber', label: 'Cyber/CUI' },
  { key: 'flowDown', label: 'Flow-down/subcontract' },
  { key: 'insurance', label: 'Insurance/indemnification' },
  { key: 'ip', label: 'IP/data rights' }
];

export default function GovernanceClauseAssess() {
  const { id, scId } = useParams();
  const navigate = useNavigate();
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(FACTORS.map((f) => [f.key, 2]))
  );
  const [rationale, setRationale] = useState('');
  const [mitigation, setMitigation] = useState('');
  const [flowDown, setFlowDown] = useState(false);
  const [flowdownReviewCompleted, setFlowdownReviewCompleted] = useState(false);
  const [clause, setClause] = useState<{ clause_number: string; title: string; base_risk_score?: number; effective_risk_score?: number; flow_down_required?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!scId) return;
    client.get(`/solicitation-clauses/${scId}`).then((r) => {
      const c = r.data;
      if (c) {
        setClause({
          clause_number: c.clause_number,
          title: c.title,
          base_risk_score: c.base_risk_score,
          effective_risk_score: c.effective_risk_score,
          flow_down_required: c.flow_down_required
        });
        setFlowDown(c.flow_down_required ?? false);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [scId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scId) return;
    setSubmitting(true);
    try {
      await client.post(`/solicitation-clauses/${scId}/assess`, {
        ...scores,
        rationale: rationale || undefined,
        recommendedMitigation: mitigation || undefined,
        requiresFlowDown: flowDown,
        flowdownReviewCompleted: flowDown ? flowdownReviewCompleted : true
      });
      navigate(`/governance-engine/solicitations/${id}/engine`, { replace: true });
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Assessment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <Link to={`/governance-engine/solicitations/${id}/engine`} className="text-sm text-gov-blue hover:underline mb-4 inline-block">← Back</Link>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-2">Assess Clause Risk</h1>
      {clause && (
        <div className="mb-6 space-y-1">
          <p className="text-slate-500">{clause.clause_number} — {clause.title}</p>
          {(clause.base_risk_score != null || clause.effective_risk_score != null) && (
            <p className="text-sm text-slate-600">
              Base risk score: {clause.base_risk_score ?? '—'} | Effective (canonical): {clause.effective_risk_score ?? '—'}
            </p>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        {FACTORS.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{f.label} (0-5)</label>
            <select
              value={scores[f.key] ?? 2}
              onChange={(e) => setScores({ ...scores, [f.key]: parseInt(e.target.value, 10) })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            >
              {[0, 1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Rationale</label>
          <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} className="w-full px-4 py-2 border rounded-lg h-24" placeholder="Optional" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Recommended Mitigation</label>
          <textarea value={mitigation} onChange={(e) => setMitigation(e.target.value)} className="w-full px-4 py-2 border rounded-lg h-24" placeholder="Optional" />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={flowDown} onChange={(e) => setFlowDown(e.target.checked)} />
          <span>Requires flow-down to subcontractors</span>
        </label>
        {flowDown && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={flowdownReviewCompleted} onChange={(e) => setFlowdownReviewCompleted(e.target.checked)} />
            <span>Flowdown Review completed</span>
          </label>
        )}
        <div className="flex gap-4 pt-4">
          <button type="submit" disabled={submitting} className="px-6 py-2 bg-gov-blue text-white rounded-lg font-medium">
            Submit Assessment
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
