import { useEffect, useState } from 'react';
import client from '../api/client';

interface Rate {
  id: string;
  rate_type: string;
  rate_value: number;
  effective_date: string;
  quarter: string;
}

export default function Financials() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/financials/rates').then((r) => {
      setRates(r.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">Financials</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
          <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Indirect Rates</h2>
          {loading ? (
            <div className="text-slate-500">Loading...</div>
          ) : (
            <div className="space-y-4">
              {rates.map((r) => (
                <div key={r.id} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                  <div>
                    <span className="font-medium">{r.rate_type}</span>
                    <span className="text-slate-500 text-sm ml-2">{r.quarter}</span>
                  </div>
                  <span className="font-mono text-lg">{(r.rate_value * 100).toFixed(2)}%</span>
                </div>
              ))}
              {rates.length === 0 && <p className="text-slate-500 text-sm">No rates configured. Run db:seed.</p>}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
          <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Job Cost Entry</h2>
          <p className="text-slate-500 text-sm">Use the Contract Detail page to view and add job costs for each contract.</p>
        </div>
      </div>
    </div>
  );
}
