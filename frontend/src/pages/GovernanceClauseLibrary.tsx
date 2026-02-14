import { useEffect, useState } from 'react';
import client from '../api/client';

interface ClauseItem {
  id: string;
  clause_number: string;
  title: string;
  category?: string;
  default_financial: number;
  default_cyber: number;
  default_liability: number;
  default_regulatory: number;
  default_performance: number;
  notes?: string;
}

export default function GovernanceClauseLibrary() {
  const [clauses, setClauses] = useState<ClauseItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/governance/clause-library', { params: search ? { search } : {} }).then((r) => {
      setClauses(r.data);
      setLoading(false);
    });
  }, [search]);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">Clause Library</h1>
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search clause number or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-slate-300 rounded-lg"
        />
      </div>
      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clause</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Default Scores (F/C/L/R/P)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {clauses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono font-medium">{c.clause_number}</td>
                  <td className="px-6 py-4 text-sm">{c.title}</td>
                  <td className="px-6 py-4 text-sm">{c.category ?? '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    {c.default_financial}/{c.default_cyber}/{c.default_liability}/{c.default_regulatory}/{c.default_performance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clauses.length === 0 && <div className="p-12 text-center text-slate-500">No clauses found</div>}
        </div>
      )}
    </div>
  );
}
