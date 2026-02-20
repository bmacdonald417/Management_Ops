/**
 * Phase 2: Proposal & Governance Automation — list proposals.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';

interface Proposal {
  id: string;
  title: string;
  status: string;
  proposal_type: string;
  submission_deadline: string | null;
  solicitation_id: string | null;
  solicitation_title?: string;
  solicitation_number?: string;
  updated_at: string;
}

export default function Proposals() {
  const [list, setList] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((v, k) => { params[k] = v; });
    client.get('/proposals', { params })
      .then((r) => { setList((r.data ?? []) as Proposal[]); setLoading(false); })
      .catch(() => { setList([]); setLoading(false); });
  }, [searchParams]);

  const statusClass: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-800',
    IN_REVIEW: 'bg-blue-100 text-blue-800',
    SUBMITTED: 'bg-amber-100 text-amber-800',
    AWARDED: 'bg-green-100 text-green-800',
    ARCHIVED: 'bg-slate-200 text-slate-600'
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Proposals</h1>
        <Link
          to="/governance-engine/proposals/new"
          className="px-4 py-2 bg-gov-blue text-white rounded-lg font-medium hover:opacity-90"
        >
          New Proposal
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        <Link to="/governance-engine/proposals" className={`px-4 py-2 rounded-lg text-sm ${!searchParams.get('status') ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>All</Link>
        <Link to="?status=DRAFT" className={`px-4 py-2 rounded-lg text-sm ${searchParams.get('status') === 'DRAFT' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>Draft</Link>
        <Link to="?status=IN_REVIEW" className={`px-4 py-2 rounded-lg text-sm ${searchParams.get('status') === 'IN_REVIEW' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>In Review</Link>
        <Link to="?status=SUBMITTED" className={`px-4 py-2 rounded-lg text-sm ${searchParams.get('status') === 'SUBMITTED' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>Submitted</Link>
        <Link to="?status=AWARDED" className={`px-4 py-2 rounded-lg text-sm ${searchParams.get('status') === 'AWARDED' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>Awarded</Link>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Solicitation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Deadline</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <Link to={`/governance-engine/proposals/${p.id}`} className="font-medium text-gov-blue hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm">{p.proposal_type}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${statusClass[p.status] ?? 'bg-slate-100'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {p.solicitation_number ? (
                      <Link to={`/governance-engine/solicitations/${p.solicitation_id}/engine`} className="text-gov-blue hover:underline">
                        {p.solicitation_number}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {p.submission_deadline ? new Date(p.submission_deadline).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/governance-engine/proposals/${p.id}`} className="text-sm text-gov-blue hover:underline">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-500">No proposals yet. Create one from a solicitation or start from scratch.</div>
          )}
        </div>
      )}
    </div>
  );
}
