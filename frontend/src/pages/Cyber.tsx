import { useEffect, useState } from 'react';
import client from '../api/client';

interface Control {
  control_identifier: string;
  domain: string;
  practice_statement: string;
  level: string;
}

interface Incident {
  id: string;
  description: string;
  status: string;
  incident_level: number;
  created_at: string;
}

export default function Cyber() {
  const [controls, setControls] = useState<Control[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState<string | null>(null);

  useEffect(() => {
    const params = domainFilter ? { domain: domainFilter } : {};
    Promise.all([
      client.get('/cyber/cmmc/controls', { params }),
      client.get('/cyber/incidents')
    ]).then(([c, i]) => {
      setControls(c.data);
      setIncidents(i.data);
      setLoading(false);
    });
  }, [domainFilter]);

  const domains = Array.from(new Set(controls.map((c) => c.domain)));

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">Cyber & CMMC</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
          <div className="text-sm text-slate-500 uppercase tracking-wide">CMMC Controls</div>
          <div className="text-3xl font-bold text-gov-blue mt-1">{controls.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
          <div className="text-sm text-slate-500 uppercase tracking-wide">Domains</div>
          <div className="text-3xl font-bold text-gov-navy mt-1">{domains.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
          <div className="text-sm text-slate-500 uppercase tracking-wide">Open Incidents</div>
          <div className="text-3xl font-bold text-red-600 mt-1">
            {incidents.filter((i) => ['Investigating', 'Reported'].includes(i.status)).length}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        <button
          onClick={() => setDomainFilter(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${!domainFilter ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}
        >
          All Domains
        </button>
        {domains.map((d) => (
          <button
            key={d}
            onClick={() => setDomainFilter(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${domainFilter === d ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-100">
        <h2 className="px-6 py-4 font-display font-semibold text-lg border-b border-slate-100">CMMC Level 2 Controls</h2>
        {loading ? (
          <div className="p-8 text-slate-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Control</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Domain</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Practice Statement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {controls.slice(0, 20).map((c) => (
                <tr key={c.control_identifier} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-sm">{c.control_identifier}</td>
                  <td className="px-6 py-4 text-sm">{c.domain}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{c.practice_statement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {controls.length > 20 && (
          <div className="px-6 py-3 text-sm text-slate-500">Showing 20 of {controls.length} controls</div>
        )}
      </div>
    </div>
  );
}
