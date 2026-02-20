import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import RiskBadge from '../components/governance/RiskBadge';
import ProposalsWidget from '../components/dashboard/ProposalsWidget';
import GovernanceDoctrineWidget from '../components/dashboard/GovernanceDoctrineWidget';

interface DashboardData {
  cards: { openDrafts: number; awaitingApproval: number; escalations: number; finalized: number; highRisk: number; avgRisk: number };
  riskDistribution: Record<number, number>;
  myWorkQueue: Record<string, unknown>[];
  recentlyFinalized: Record<string, unknown>[];
}

export default function GovernanceEngine() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    client.get('/governance/dashboard').then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Governance Engine</h1>
        <div className="flex gap-2">
          <Link to="/governance-engine/solicitations/engine/new" className="px-4 py-2 bg-gov-blue text-white rounded-lg font-medium hover:bg-gov-blue-light">
            New Solicitation (Engine)
          </Link>
          <Link to="/governance-engine/solicitations/new" className="px-4 py-2 border border-gov-blue text-gov-blue rounded-lg font-medium">
            New (Legacy)
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Link to="/governance-engine/solicitations?status=DRAFT" className="bg-white rounded-xl shadow p-4 border border-slate-100 hover:border-gov-blue">
          <div className="text-sm text-slate-500">Open Drafts</div>
          <div className="text-2xl font-bold text-gov-navy">{data.cards.openDrafts}</div>
        </Link>
        <Link to="/governance-engine/solicitations?status=AWAITING_APPROVALS" className="bg-white rounded-xl shadow p-4 border border-slate-100 hover:border-gov-blue">
          <div className="text-sm text-slate-500">Awaiting Approval</div>
          <div className="text-2xl font-bold text-amber-600">{data.cards.awaitingApproval}</div>
        </Link>
        <div className="bg-white rounded-xl shadow p-4 border border-slate-100">
          <div className="text-sm text-slate-500">Escalations</div>
          <div className="text-2xl font-bold text-red-600">{data.cards.escalations}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border border-slate-100">
          <div className="text-sm text-slate-500">Finalized (30d)</div>
          <div className="text-2xl font-bold text-green-600">{data.cards.finalized}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border border-slate-100">
          <div className="text-sm text-slate-500">High Risk (L3/L4)</div>
          <div className="text-2xl font-bold text-orange-600">{data.cards.highRisk}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border border-slate-100">
          <div className="text-sm text-slate-500">Avg Risk Score</div>
          <div className="text-2xl font-bold text-gov-navy">{data.cards.avgRisk}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <ProposalsWidget />
        <GovernanceDoctrineWidget />
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100 md:col-span-2 lg:col-span-1">
          <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Risk Distribution</h2>
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((l) => (
              <div key={l} className="flex items-center gap-2">
                <RiskBadge level={l} />
                <span className="text-2xl font-bold">{data.riskDistribution[l] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
          <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">My Work Queue</h2>
          {data.myWorkQueue.length === 0 ? (
            <p className="text-slate-500 text-sm">No items in queue</p>
          ) : (
            <ul className="space-y-2">
              {data.myWorkQueue.map((s) => (
                <li key={s.id as string}>
                  <Link to={`/governance-engine/solicitations/${s.id}/review`} className="text-gov-blue hover:underline font-medium">
                    {(s as { solicitation_number: string }).solicitation_number}
                  </Link>
                  <span className="text-slate-500 text-sm ml-2">{(s as { title: string }).title}</span>
                  <span className="ml-2"><RiskBadge level={((s as { overall_risk_level?: number }).overall_risk_level ?? 1) as number} size="sm" /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <Link to="/governance-engine/solicitations" className="text-gov-blue hover:underline font-medium">
          View All Solicitations →
        </Link>
        <Link to="/governance-engine/clause-library" className="text-gov-blue hover:underline font-medium">
          Clause Library →
        </Link>
        <Link to="/governance-engine/maturity" className="text-gov-blue hover:underline font-medium">
          Maturity Index →
        </Link>
        <Link to="/governance-engine/reports" className="text-gov-blue hover:underline font-medium">
          Reports →
        </Link>
      </div>
    </div>
  );
}
