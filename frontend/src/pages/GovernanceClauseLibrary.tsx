import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';
import CopilotDrawer from '../components/governance/CopilotDrawer';

interface ClauseItem {
  id: string;
  clause_number: string;
  clauseNumber?: string;
  title: string;
  effective_risk_category?: string | null;
  effective_risk_score?: number | null;
  base_risk_category?: string | null;
  base_risk_score?: number | null;
  hasOverlay?: boolean;
  default_financial?: number;
  default_cyber?: number;
  default_liability?: number;
  default_regulatory?: number;
  default_performance?: number;
  notes?: string | null;
}

export default function GovernanceClauseLibrary() {
  const { user } = useAuth();
  const [clauses, setClauses] = useState<ClauseItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [selectedClause, setSelectedClause] = useState<ClauseItem | null>(null);

  const load = () => {
    setLoading(true);
    client.get('/compliance/library/search', { params: { q: search, limit: 100 } }).then((r) => {
      setClauses(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, [search]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Clause Library</h1>
        <button
          onClick={() => { setSelectedClause(null); setCopilotOpen(true); }}
          className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium"
        >
          AI Copilot
        </button>
      </div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase w-20"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clause</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Scores</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-slate-200">
              {clauses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => { setSelectedClause(c); setCopilotOpen(true); }}
                      className="text-gov-blue hover:underline text-xs"
                    >
                      Copilot
                    </button>
                  </td>
                  <td className="px-6 py-4 font-mono font-medium">
                    {c.clause_number ?? c.clauseNumber}
                    {c.hasOverlay && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        Override Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">{c.title}</td>
                  <td className="px-6 py-4 text-sm">
                    {c.effective_risk_category ?? c.base_risk_category ?? '—'}
                    {c.hasOverlay && c.base_risk_category && c.effective_risk_category !== c.base_risk_category && (
                      <span className="text-slate-400 text-xs ml-1">(base: {c.base_risk_category})</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {c.effective_risk_score ?? c.base_risk_score ?? '—'}
                    {c.hasOverlay && c.base_risk_score != null && c.effective_risk_score !== c.base_risk_score && (
                      <span className="text-slate-400 text-xs ml-1">(base: {c.base_risk_score})</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {[c.default_financial, c.default_cyber, c.default_liability, c.default_regulatory, c.default_performance]
                      .every((n) => n != null)
                      ? `${c.default_financial}/${c.default_cyber}/${c.default_liability}/${c.default_regulatory}/${c.default_performance}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clauses.length === 0 && <div className="p-12 text-center text-slate-500">No clauses found</div>}
        </div>
      )}
      <CopilotDrawer
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        context={{
          clauseNumber: selectedClause?.clause_number,
          clauseId: selectedClause?.id
        }}
        userRole={user?.role}
        onApplyClauseEnrich={() => { load(); setCopilotOpen(false); }}
      />
    </div>
  );
}
