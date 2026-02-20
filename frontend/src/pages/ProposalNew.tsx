/**
 * Create a new proposal, optionally linked to a solicitation.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import client from '../api/client';

export default function ProposalNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const solicitationId = searchParams.get('solicitationId') ?? undefined;

  const [title, setTitle] = useState('');
  const [proposalType, setProposalType] = useState('Solicitation');
  const [submitting, setSubmitting] = useState(false);
  const [solicitationTitle, setSolicitationTitle] = useState<string | null>(null);

  useEffect(() => {
    if (solicitationId) {
      client.get(`/solicitations/${solicitationId}`)
        .then((r) => setSolicitationTitle((r.data as { title?: string })?.title ?? null))
        .catch(() => {});
    }
  }, [solicitationId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    client.post('/proposals', { title: title.trim(), proposalType, solicitationId: solicitationId || undefined })
      .then((r) => { navigate(`/governance-engine/proposals/${(r.data as { id: string }).id}`); })
      .catch(() => setSubmitting(false));
  };

  return (
    <div>
      <div className="mb-4">
        <Link to="/governance-engine/proposals" className="text-sm text-gov-blue hover:underline">← Proposals</Link>
      </div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">New Proposal</h1>
      {solicitationId && solicitationTitle && (
        <p className="mb-4 text-slate-600">Linked to solicitation: <strong>{solicitationTitle}</strong></p>
      )}
      <form onSubmit={submit} className="max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="e.g. ABC Agency RFP 2025 Proposal"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
          <select value={proposalType} onChange={(e) => setProposalType(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2">
            <option value="Solicitation">Solicitation</option>
            <option value="RFP">RFP</option>
            <option value="SOW">SOW</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-gov-blue text-white rounded-lg font-medium disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create'}
          </button>
          <button type="button" onClick={() => navigate('/governance-engine/proposals')} className="px-4 py-2 border border-slate-300 rounded-lg">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
