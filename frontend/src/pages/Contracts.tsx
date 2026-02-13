import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';

interface Contract {
  id: string;
  title: string;
  contract_number: string;
  agency: string;
  status: string;
  total_contract_value: number;
  period_of_performance_end: string;
  overall_risk_level: number;
}

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');

  useEffect(() => {
    const params = statusFilter ? { status: statusFilter } : {};
    client.get('/contracts', { params }).then((r) => {
      setContracts(r.data);
      setLoading(false);
    });
  }, [statusFilter]);

  const statusColors: Record<string, string> = {
    Opportunity: 'bg-amber-100 text-amber-800',
    'Pre-Bid': 'bg-blue-100 text-blue-800',
    Awarded: 'bg-emerald-100 text-emerald-800',
    Active: 'bg-green-100 text-green-800',
    Closed: 'bg-slate-100 text-slate-800'
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Contracts</h1>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contract</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Agency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <Link to={`/contracts/${c.id}`} className="font-medium text-gov-blue hover:underline">
                      {c.title || c.contract_number || c.id.slice(0, 8)}
                    </Link>
                    {c.contract_number && (
                      <div className="text-xs text-slate-500">{c.contract_number}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{c.agency || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[c.status] ?? 'bg-slate-100'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {c.total_contract_value != null
                      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(c.total_contract_value)
                      : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {c.overall_risk_level != null && (
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        c.overall_risk_level >= 4 ? 'bg-red-100 text-red-800' :
                        c.overall_risk_level === 3 ? 'bg-orange-100 text-orange-800' :
                        c.overall_risk_level === 2 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}>
                        L{c.overall_risk_level}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/contracts/${c.id}`} className="text-gov-blue hover:underline text-sm">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {contracts.length === 0 && (
            <div className="p-12 text-center text-slate-500">No contracts found. Run db:seed to add sample data.</div>
          )}
        </div>
      )}
    </div>
  );
}
