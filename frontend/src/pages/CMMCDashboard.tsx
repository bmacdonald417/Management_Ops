import { useEffect, useState } from 'react';
import client from '../api/client';

interface DomainSummary {
  name: string;
  total: number;
  adjudicated: number;
  implemented: number;
  partial: number;
  not_implemented: number;
}

interface DashboardSummary {
  totalControls: number;
  adjudicatedCount: number;
  outstandingCount: number;
  adjudicatedPercent: number;
  domains: DomainSummary[];
}

export default function CMMCDashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client
      .get<DashboardSummary>('/cyber/dashboard-summary')
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <p className="text-slate-500">Loading CMMC status...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <p className="text-red-600">{error ?? 'No data available'}</p>
      </div>
    );
  }

  const { totalControls, adjudicatedCount, outstandingCount, adjudicatedPercent, domains } = data;

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-2">CMMC Live Status Dashboard</h1>
      <p className="text-slate-600 mb-8">
        Implementation status of CMMC Level 2 controls based on the latest evidence bundle ingest.
      </p>

      {/* Main KPI Bar */}
      <div className="bg-gov-navy text-white rounded-xl p-6 mb-8 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-baseline gap-6">
            <div>
              <span className="text-4xl font-bold">{adjudicatedCount}</span>
              <span className="text-slate-300 text-lg ml-1">/ {totalControls}</span>
            </div>
            <div className="text-slate-300">
              <span className="font-semibold text-white">{adjudicatedPercent}%</span> adjudicated
            </div>
            <div className="text-amber-300">
              <span className="font-semibold">{outstandingCount}</span> outstanding
            </div>
          </div>
        </div>
        <div className="mt-4 h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gov-blue transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, adjudicatedPercent)}%` }}
          />
        </div>
      </div>

      {/* Domain Breakdown */}
      <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Domain Breakdown</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {domains.map((d) => {
          const pct = d.total > 0 ? Math.round((d.adjudicated / d.total) * 100) : 0;
          return (
            <div
              key={d.name}
              className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition"
            >
              <h3 className="font-medium text-gov-navy mb-2">{d.name}</h3>
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                <span>
                  {d.adjudicated}/{d.total} adjudicated
                </span>
                <span className="font-medium">{pct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gov-blue rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="text-green-600">✅</span>
                  <span>{d.implemented}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-amber-600">⚠️</span>
                  <span>{d.partial}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-red-600">❌</span>
                  <span>{d.not_implemented}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {domains.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          No adjudicated controls yet. Upload an evidence bundle via Admin → CMMC Evidence to populate this dashboard.
        </div>
      )}
    </div>
  );
}
