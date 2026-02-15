import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

interface RegulatoryClause {
  id: string;
  regulationType: string;
  part: string;
  clauseNumber: string;
  title: string;
  riskScore: number | null;
  riskCategory: string | null;
  flowDownRequired: boolean;
}

export default function AdminRegulatoryLibrary() {
  const [clauses, setClauses] = useState<RegulatoryClause[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regulationType, setRegulationType] = useState<string>('');
  const [riskScore, setRiskScore] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (regulationType) params.set('regulationType', regulationType);
    if (riskScore) params.set('riskScore', riskScore);
    client
      .get(`/admin/regulatory-clauses?${params.toString()}`)
      .then((r) => setClauses(r.data))
      .catch(() => setClauses([]))
      .finally(() => setLoading(false));
  }, [search, regulationType, riskScore]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Regulatory Library</h1>
        <Link to="/admin/compliance-registry" className="text-gov-blue hover:underline">
          ← Compliance Registry
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Filters</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Clause number or title..."
              className="w-64 px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Regulation</label>
            <select
              value={regulationType}
              onChange={(e) => setRegulationType(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">All</option>
              <option value="FAR">FAR</option>
              <option value="DFARS">DFARS</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Risk Score</label>
            <select
              value={riskScore}
              onChange={(e) => setRiskScore(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">All</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <h3 className="p-4 font-medium text-gov-navy">Clause Entries</h3>
        {loading ? (
          <div className="p-8 text-slate-500 text-center">Loading...</div>
        ) : clauses.length === 0 ? (
          <div className="p-8 text-slate-500 text-center">
            No clauses found. Run <code className="bg-slate-100 px-1 rounded">npm run reg:ingest</code> in the backend to ingest FAR 52 and DFARS 252.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Regulation</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Clause</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Title</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Risk</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Category</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Flow Down</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {clauses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm">{c.regulationType}</td>
                    <td className="px-4 py-2 text-sm font-mono">{c.clauseNumber}</td>
                    <td className="px-4 py-2 text-sm max-w-md truncate" title={c.title}>
                      {c.title}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          (c.riskScore ?? 0) >= 4
                            ? 'bg-red-100 text-red-800'
                            : (c.riskScore ?? 0) >= 3
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.riskScore ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600">{c.riskCategory ?? '—'}</td>
                    <td className="px-4 py-2">{c.flowDownRequired ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
