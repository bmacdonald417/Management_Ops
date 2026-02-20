/**
 * Phase 5: Proposals summary widget for the unified dashboard.
 * Shows counts by status, upcoming deadlines, and quick links.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';

interface ProposalSummary {
  id: string;
  title: string;
  status: string;
  submission_deadline: string | null;
}

interface Counts {
  DRAFT: number;
  IN_REVIEW: number;
  SUBMITTED: number;
  total: number;
}

export default function ProposalsWidget() {
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/proposals', { params: { limit: 200 } })
      .then((r) => setProposals(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProposals([]))
      .finally(() => setLoading(false));
  }, []);

  const counts: Counts = proposals.reduce(
    (acc, p) => {
      acc.total++;
      if (p.status === 'DRAFT') acc.DRAFT++;
      else if (p.status === 'IN_REVIEW') acc.IN_REVIEW++;
      else if (p.status === 'SUBMITTED') acc.SUBMITTED++;
      return acc;
    },
    { DRAFT: 0, IN_REVIEW: 0, SUBMITTED: 0, total: 0 }
  );

  const now = new Date();
  const upcoming = proposals
    .filter((p) => p.submission_deadline && new Date(p.submission_deadline) >= now && ['DRAFT', 'IN_REVIEW'].includes(p.status))
    .sort((a, b) => new Date(a.submission_deadline!).getTime() - new Date(b.submission_deadline!).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
        <h2 className="font-display font-semibold text-lg text-gov-navy mb-3">Proposals</h2>
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 border border-slate-100 hover:border-gov-blue/30 transition-colors">
      <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Proposals</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link to="/governance-engine/proposals?status=DRAFT" className="rounded-lg p-3 bg-slate-50 border border-slate-100 hover:border-gov-blue/50">
          <div className="text-xs text-slate-500">Draft</div>
          <div className="text-xl font-bold text-gov-navy">{counts.DRAFT}</div>
        </Link>
        <Link to="/governance-engine/proposals?status=IN_REVIEW" className="rounded-lg p-3 bg-slate-50 border border-slate-100 hover:border-gov-blue/50">
          <div className="text-xs text-slate-500">In Review</div>
          <div className="text-xl font-bold text-amber-600">{counts.IN_REVIEW}</div>
        </Link>
        <Link to="/governance-engine/proposals?status=SUBMITTED" className="rounded-lg p-3 bg-slate-50 border border-slate-100 hover:border-gov-blue/50">
          <div className="text-xs text-slate-500">Submitted</div>
          <div className="text-xl font-bold text-green-600">{counts.SUBMITTED}</div>
        </Link>
        <div className="rounded-lg p-3 bg-slate-50 border border-slate-100">
          <div className="text-xs text-slate-500">Total</div>
          <div className="text-xl font-bold text-slate-700">{counts.total}</div>
        </div>
      </div>
      {upcoming.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Upcoming deadlines</p>
          <ul className="space-y-1 text-sm">
            {upcoming.map((p) => (
              <li key={p.id}>
                <Link to={`/governance-engine/proposals/${p.id}`} className="text-gov-blue hover:underline truncate block">
                  {p.title}
                </Link>
                <span className="text-slate-500">
                  {new Date(p.submission_deadline!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
        <Link to="/governance-engine/proposals/new" className="px-3 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium hover:opacity-90">
          Create New Proposal
        </Link>
        <Link to="/governance-engine/proposals" className="px-3 py-2 border border-gov-blue text-gov-blue rounded-lg text-sm font-medium hover:bg-gov-blue hover:text-white">
          View All Proposals
        </Link>
      </div>
    </div>
  );
}
