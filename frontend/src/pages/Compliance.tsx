import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../api/client';

interface Clause {
  id: string;
  clause_number: string;
  title: string;
  regulation: string;
  risk_level: number;
  risk_category: string;
  description: string;
  flow_down_required: boolean;
}

export default function Compliance() {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const regulationFilter = searchParams.get('regulation') as string | null;
  const riskFilter = searchParams.get('risk_level');
  const search = searchParams.get('search');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (regulationFilter) params.regulation = regulationFilter;
    if (riskFilter) params.risk_level = riskFilter;
    if (search) params.search = search;
    client.get('/compliance/library', { params }).then((r) => {
      setClauses(r.data);
      setLoading(false);
    });
  }, [regulationFilter, riskFilter, search]);

  const riskColors: Record<number, string> = {
    1: 'bg-green-100 text-green-800',
    2: 'bg-yellow-100 text-yellow-800',
    3: 'bg-orange-100 text-orange-800',
    4: 'bg-red-100 text-red-800'
  };

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">Clause Library</h1>

      <div className="flex gap-4 mb-6 flex-wrap">
        <a href="?regulation=" className={`px-4 py-2 rounded-lg text-sm font-medium ${!regulationFilter ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>
          All
        </a>
        <a href="?regulation=FAR" className={`px-4 py-2 rounded-lg text-sm font-medium ${regulationFilter === 'FAR' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>
          FAR
        </a>
        <a href="?regulation=DFARS" className={`px-4 py-2 rounded-lg text-sm font-medium ${regulationFilter === 'DFARS' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>
          DFARS
        </a>
        {[1, 2, 3, 4].map((l) => (
          <a key={l} href={`?risk_level=${l}`} className={`px-4 py-2 rounded-lg text-sm font-medium ${riskFilter === String(l) ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>
            Risk L{l}
          </a>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clause</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Flow-down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {clauses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <span className="font-mono font-medium">{c.clause_number}</span>
                    <span className="text-xs text-slate-500 ml-2">{c.regulation}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">{c.title}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${riskColors[c.risk_level] ?? 'bg-slate-100'}`}>
                      Level {c.risk_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{c.flow_down_required ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {clauses.length === 0 && (
            <div className="p-12 text-center text-slate-500">No clauses found. Run db:seed to import FAR/DFARS clauses.</div>
          )}
        </div>
      )}
    </div>
  );
}
