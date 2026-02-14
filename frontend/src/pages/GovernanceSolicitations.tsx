import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import RiskBadge from '../components/governance/RiskBadge';
import EscalationPill from '../components/governance/EscalationPill';

interface Solicitation {
  id: string;
  solicitation_number: string;
  title: string;
  agency: string;
  contract_type: string;
  est_value?: number;
  cui_involved?: boolean;
  status: string;
  overall_risk_level?: number;
  escalation_required?: boolean;
  cyber_review_required?: boolean;
  financial_review_required?: boolean;
  owner_name?: string;
  updated_at: string;
}

export default function GovernanceSolicitations() {
  const [sols, setSols] = useState<Solicitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((v, k) => { params[k] = v; });
    client.get('/governance/solicitations', { params }).then((r) => {
      setSols(r.data);
      setLoading(false);
    });
  }, [searchParams]);

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-800',
    IN_REVIEW: 'bg-blue-100 text-blue-800',
    AWAITING_APPROVALS: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    FINALIZED: 'bg-green-100 text-green-800'
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Solicitations</h1>
        <Link to="/governance-engine/solicitations/new" className="px-4 py-2 bg-gov-blue text-white rounded-lg font-medium hover:bg-gov-blue-light">
          New Solicitation
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        <Link to="/governance-engine/solicitations" className={`px-4 py-2 rounded-lg text-sm ${!searchParams.get('status') ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>All</Link>
        <Link to="?status=DRAFT" className={`px-4 py-2 rounded-lg text-sm ${searchParams.get('status') === 'DRAFT' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>Draft</Link>
        <Link to="?status=AWAITING_APPROVALS" className={`px-4 py-2 rounded-lg text-sm ${searchParams.get('status') === 'AWAITING_APPROVALS' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>Awaiting Approval</Link>
        <Link to="?status=FINALIZED" className={`px-4 py-2 rounded-lg text-sm ${searchParams.get('status') === 'FINALIZED' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>Finalized</Link>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Solicitation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Agency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Escalations</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sols.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <Link to={`/governance-engine/solicitations/${s.id}/review`} className="font-medium text-gov-blue hover:underline">
                      {s.solicitation_number}
                    </Link>
                    <div className="text-xs text-slate-500">{s.title}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">{s.agency}</td>
                  <td className="px-6 py-4 text-sm">{s.contract_type}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[s.status] ?? 'bg-slate-100'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <RiskBadge level={s.overall_risk_level ?? 1} size="sm" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {s.cyber_review_required && <EscalationPill type="Cyber" />}
                      {s.financial_review_required && <EscalationPill type="Financial" />}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">{s.owner_name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <Link to={`/governance-engine/solicitations/${s.id}/review`} className="text-gov-blue hover:underline text-sm">
                      View / Continue
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sols.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              No solicitations found. <Link to="/governance-engine/solicitations/new" className="text-gov-blue hover:underline">Create one</Link>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
