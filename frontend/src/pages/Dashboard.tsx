import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

interface KPIs {
  contracts: { active: number; opportunities: number; total: number };
  riskDistribution: Record<number, number>;
  openComplianceTasks: number;
  activeCyberIncidents: number;
  pendingApprovals: number;
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<KPIs | null>(null);

  useEffect(() => {
    client.get('/dashboard/kpis').then((r) => setKpis(r.data));
  }, []);

  if (!kpis) return <div className="text-slate-500">Loading dashboard...</div>;

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">Executive Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
          <div className="text-sm text-slate-500 uppercase tracking-wide">Active Contracts</div>
          <div className="text-3xl font-bold text-gov-blue mt-1">{kpis.contracts.active}</div>
          <Link to="/contracts?status=Active" className="text-sm text-gov-blue hover:underline mt-2 inline-block">
            View all
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
          <div className="text-sm text-slate-500 uppercase tracking-wide">Opportunities</div>
          <div className="text-3xl font-bold text-amber-600 mt-1">{kpis.contracts.opportunities}</div>
          <Link to="/contracts?status=Opportunity" className="text-sm text-gov-blue hover:underline mt-2 inline-block">
            View all
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
          <div className="text-sm text-slate-500 uppercase tracking-wide">Open Compliance Tasks</div>
          <div className="text-3xl font-bold text-gov-navy mt-1">{kpis.openComplianceTasks}</div>
          <Link to="/compliance" className="text-sm text-gov-blue hover:underline mt-2 inline-block">
            Manage
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
          <div className="text-sm text-slate-500 uppercase tracking-wide">Active Cyber Incidents</div>
          <div className="text-3xl font-bold text-red-600 mt-1">{kpis.activeCyberIncidents}</div>
          <Link to="/cyber" className="text-sm text-gov-blue hover:underline mt-2 inline-block">
            View
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
        <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Portfolio Risk Distribution</h2>
        <div className="flex gap-8">
          {[1, 2, 3, 4].map((level) => (
            <div key={level} className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-gov-navy">
                {kpis.riskDistribution[level] ?? 0}
              </div>
              <span className="text-sm text-slate-600">Level {level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
