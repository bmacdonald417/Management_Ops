/**
 * Approve or reject an L3/L4 clause assessment.
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';

export default function GovernanceClauseApprove() {
  const { id, scId } = useParams();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = async (status: 'Approved' | 'Rejected') => {
    if (!scId) return;
    setSubmitting(true);
    try {
      await client.post(`/solicitation-clauses/${scId}/approve`, { status, comment });
      navigate(`/governance-engine/solicitations/${id}/engine`, { replace: true });
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Approval failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Link to={`/governance-engine/solicitations/${id}/engine`} className="text-sm text-gov-blue hover:underline mb-4 inline-block">← Back</Link>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-4">Approve Clause Assessment</h1>
      <p className="text-slate-500 mb-4">This clause requires Manager/Quality or Executive approval before the solicitation can be approved to bid.</p>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Comment (optional)</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="w-full px-4 py-2 border rounded-lg h-24" />
        </div>
        <div className="flex gap-4">
          <button onClick={() => handleApprove('Approved')} disabled={submitting} className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium">
            Approve
          </button>
          <button onClick={() => handleApprove('Rejected')} disabled={submitting} className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
