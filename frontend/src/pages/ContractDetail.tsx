import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';

interface Contract {
  id: string;
  title: string;
  contract_number: string;
  agency: string;
  status: string;
  total_contract_value: number;
  funded_amount: number;
  period_of_performance_start: string;
  period_of_performance_end: string;
}

interface Clause {
  id: string;
  clause_number: string;
  title: string;
  regulation: string;
  risk_level: number;
  compliance_status: string;
  link_id: string;
}

interface Cost {
  id: string;
  log_date: string;
  total_cost: number;
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      client.get(`/contracts/${id}`),
      client.get(`/compliance/contracts/${id}/clauses`),
      client.get(`/financials/contracts/${id}/costs`)
    ])
      .then(([c, cl, co]) => {
        setContract(c.data);
        setClauses(cl.data);
        setCosts(co.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !contract) return <div className="text-slate-500">Loading...</div>;

  const linkedClauses = clauses.filter((c) => c.link_id);

  return (
    <div>
      <Link to="/contracts" className="text-sm text-gov-blue hover:underline mb-4 inline-block">← Back to Contracts</Link>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">{contract.title || contract.contract_number}</h1>
        <p className="text-slate-500 mt-1">{contract.contract_number} • {contract.agency}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
            <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Contract Details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-slate-500">Status</dt><dd className="font-medium">{contract.status}</dd></div>
              <div><dt className="text-slate-500">Total Value</dt><dd className="font-medium">
                {contract.total_contract_value != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(contract.total_contract_value) : '—'}
              </dd></div>
              <div><dt className="text-slate-500">Funded Amount</dt><dd className="font-medium">
                {contract.funded_amount != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(contract.funded_amount) : '—'}
              </dd></div>
              <div><dt className="text-slate-500">POP End</dt><dd className="font-medium">{contract.period_of_performance_end || '—'}</dd></div>
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
            <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Contract Clauses</h2>
            {linkedClauses.length === 0 ? (
              <p className="text-slate-500 text-sm">No clauses linked. Link clauses from the Compliance module.</p>
            ) : (
              <div className="space-y-2">
                {linkedClauses.slice(0, 10).map((c) => (
                  <div key={c.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <span className="font-mono text-sm">{c.clause_number}</span>
                      <span className="text-slate-500 text-xs ml-2">{c.regulation}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      c.compliance_status === 'Compliant' ? 'bg-green-100' :
                      c.compliance_status === 'In Progress' ? 'bg-blue-100' : 'bg-slate-100'
                    }`}>
                      {c.compliance_status || 'Not Started'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link to={`/compliance?contract=${id}`} className="text-sm text-gov-blue hover:underline mt-4 inline-block">
              Manage clauses →
            </Link>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
            <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Job Costs</h2>
            {costs.length === 0 ? (
              <p className="text-slate-500 text-sm">No cost entries yet.</p>
            ) : (
              <div className="space-y-2">
                {costs.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex justify-between text-sm">
                    <span>{c.log_date}</span>
                    <span className="font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c.total_cost)}</span>
                  </div>
                ))}
              </div>
            )}
            <Link to="/financials" className="text-sm text-gov-blue hover:underline mt-4 inline-block">
              View financials →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
