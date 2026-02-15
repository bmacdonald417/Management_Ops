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
  const [clause, setClause] = useState<{ clause_number: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id || !scId) return;
    client.get(`/solicitations/${id}`).then((r) => {
      const c = (r.data.solicitation_clauses ?? []).find((x: { id: string }) => x.id === scId);
      if (c) setClause({ clause_number: c.clause_number, title: c.title });
      setLoading(false);
    });
  }, [id, scId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scId) return;
    setSubmitting(true);
    try {
      await client.post(`/solicitation-clauses/${scId}/assess`, {
        ...scores,
        rationale: rationale || undefined,
        recommendedMitigation: mitigation || undefined,
        requiresFlowDown: flowDown
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
        <p className="text-slate-500 mb-6">{clause.clause_number} — {clause.title}</p>
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
