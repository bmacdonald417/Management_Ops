import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

interface MaturityResult {
  overallScore: number;
  pillarContract: number;
  pillarFinancial: number;
  pillarCyber: number;
  pillarInsurance: number;
  pillarStructural: number;
  pillarAudit: number;
  pillarDocumentation: number;
  gapTable: { metricName: string; currentPct: number; targetPct: number; delta: number }[];
  disconnectIndicators: string[];
}

const PILLARS = [
  { key: 'pillarContract', label: 'Contract' },
  { key: 'pillarFinancial', label: 'Financial' },
  { key: 'pillarCyber', label: 'Cyber' },
  { key: 'pillarInsurance', label: 'Insurance' },
  { key: 'pillarStructural', label: 'Structural' },
  { key: 'pillarAudit', label: 'Audit' },
  { key: 'pillarDocumentation', label: 'Documentation' }
];

function scoreColor(pct: number): string {
  if (pct < 50) return 'text-red-600';
  if (pct < 75) return 'text-amber-600';
  return 'text-green-600';
}

function scoreBgColor(pct: number): string {
  if (pct < 50) return 'bg-red-500';
  if (pct < 75) return 'bg-amber-500';
  return 'bg-green-500';
}

export default function GovernanceMaturity() {
  const [data, setData] = useState<MaturityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeSnapshot, setStoreSnapshot] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    client.get('/governance/maturity', { params: storeSnapshot ? { store: 'true' } : {} }).then((r) => {
      setData(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [storeSnapshot]);

  const handlePrint = () => {
    window.print();
  };

  if (loading && !data) return <div className="text-slate-500">Computing maturity index...</div>;
  if (!data) return <div className="text-slate-500">Failed to load maturity data.</div>;

  const isEmpty = data.overallScore === 0 && (!data.gapTable?.length || data.gapTable[0]?.metricName?.includes('No'));

  return (
    <div>
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Governance Completeness Index</h1>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={storeSnapshot} onChange={(e) => setStoreSnapshot(e.target.checked)} />
            Store snapshot on load
          </label>
          <button onClick={load} className="px-4 py-2 bg-slate-200 rounded-lg text-sm">Refresh</button>
          <button onClick={handlePrint} className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
            Export Maturity Report
          </button>
        </div>
      </div>

      <div ref={printRef} className="space-y-6">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col md:flex-row gap-8 items-center">
          <div className="relative w-40 h-40 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${data.overallScore}, ${100 - data.overallScore}`}
                className={scoreColor(data.overallScore)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${scoreColor(data.overallScore)}`}>{data.overallScore.toFixed(1)}%</span>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="font-display font-semibold text-lg text-gov-navy mb-2">Overall Score</h2>
            {isEmpty ? (
              <p className="text-slate-500">No solicitations in system. Create solicitations and complete the governance workflow to see maturity scores.</p>
            ) : (
              <p className="text-slate-600">Automated index from live data. Scores update as solicitations, clause reviews, approvals, and audit events are recorded.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Pillar Scores</h2>
          <div className="space-y-3">
            {PILLARS.map((p) => {
              const val = data[p.key as keyof MaturityResult] as number;
              return (
                <div key={p.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{p.label}</span>
                    <span className={scoreColor(val)}>{val.toFixed(1)}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${scoreBgColor(val)} rounded-full transition-all`} style={{ width: `${Math.min(100, val)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Gap Analysis</h2>
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm font-medium text-slate-500">Metric</th>
                <th className="text-right py-2 text-sm font-medium text-slate-500">Current %</th>
                <th className="text-right py-2 text-sm font-medium text-slate-500">Target %</th>
                <th className="text-right py-2 text-sm font-medium text-slate-500">Delta</th>
              </tr>
            </thead>
            <tbody>
              {data.gapTable?.map((row, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{row.metricName}</td>
                  <td className={`py-2 text-right font-medium ${scoreColor(row.currentPct)}`}>{row.currentPct}</td>
                  <td className="py-2 text-right text-slate-500">{row.targetPct}</td>
                  <td className={`py-2 text-right ${row.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>{row.delta >= 0 ? '+' : ''}{row.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Automation Disconnect Indicators</h2>
          {data.disconnectIndicators?.length === 0 ? (
            <p className="text-green-600">No disconnect indicators. Governance workflow appears consistent.</p>
          ) : (
            <ul className="space-y-2">
              {data.disconnectIndicators?.map((ind, i) => (
                <li key={i} className="flex items-center gap-2 text-amber-700">
                  <span className="text-amber-500">⚠</span>
                  {ind}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-slate-500 print:block">Generated {new Date().toLocaleString()} — MacTech Governance Platform</p>
      </div>

      <div className="mt-6 print:hidden">
        <Link to="/governance-engine" className="text-gov-blue hover:underline">← Back to Governance Engine</Link>
      </div>
    </div>
  );
}
