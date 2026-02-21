import { useEffect, useState } from 'react';
import client from '../api/client';

interface DomainData {
  name: string;
  total: number;
  implemented: number;
  partially_implemented: number;
  governed: number;
  inherited: number;
  not_applicable: number;
  evidenceFiles: number;
}

interface ControlWithEvidence {
  control_id: string;
  domain: string;
  status: string;
  class: string | null;
  evidence_file_count: number;
  evidence_files: Array<{
    filename: string;
    sha256: string | null;
  }>;
}

interface DashboardData {
  summary: {
    totalControls: number;
    implemented: number;
    partiallyImplemented: number;
    governed: number;
    inherited: number;
    notApplicable: number;
    applicable: number;
    adjudicated: number;
    outstanding: number;
    adjudicatedPercent: number;
    totalEvidenceReferences: number;
  };
  buckets: Array<{
    name: string;
    total: number;
    implemented: number;
  }>;
  domains: DomainData[];
  bundleInfo: {
    bundleVersion: string;
    trustCodexVersion: string;
    bundleHash: string;
    ingestedAt: string;
  } | null;
}

interface EvidenceReference {
  control_id: string;
  domain: string;
  status: string;
  filename: string;
  sha256: string | null;
}

interface UniqueEvidenceFile {
  filename: string;
  sha256: string | null;
  control_ids: string[];
  control_count: number;
}

interface EvidenceExplorerData {
  references: EvidenceReference[];
  uniqueFiles: UniqueEvidenceFile[];
}

interface StatusCard {
  label: string;
  count: number;
  color: string;
  bgColor: string;
  textColor: string;
}

const NIST_SECTION_MAP: Record<string, string> = {
  'Access Control': '§ 3.1',
  'Awareness and Training': '§ 3.2',
  'Audit and Accountability': '§ 3.3',
  'Configuration Management': '§ 3.4',
  'Identification and Authentication': '§ 3.5',
  'Incident Response': '§ 3.6',
  'Maintenance': '§ 3.7',
  'Media Protection': '§ 3.8',
  'Personnel Security': '§ 3.9',
  'Physical Protection': '§ 3.10',
  'Risk Assessment': '§ 3.11',
  'Security Assessment': '§ 3.12',
  'System and Communications Protection': '§ 3.13',
  'System and Information Integrity': '§ 3.14'
};

export default function CMMCDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainData | null>(null);
  const [domainControls, setDomainControls] = useState<ControlWithEvidence[]>([]);
  const [loadingControls, setLoadingControls] = useState(false);
  const [selectedEvidenceFile, setSelectedEvidenceFile] = useState<{ filename: string; sha256: string | null } | null>(null);
  const [selectedEvidenceControlIds, setSelectedEvidenceControlIds] = useState<string[] | null>(null);

  // Evidence Explorer: load when user requests it (click evidence count or open section)
  const [evidenceRequested, setEvidenceRequested] = useState(false);
  const [evidenceData, setEvidenceData] = useState<EvidenceExplorerData | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceViewMode, setEvidenceViewMode] = useState<'reference' | 'file'>('file');
  const [evidenceFilters, setEvidenceFilters] = useState({ domain: '', status: '', filename: '' });

  useEffect(() => {
    client
      .get<DashboardData>('/cyber/cmmc-dashboard')
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      setLoadingControls(true);
      client
        .get<{ controls: ControlWithEvidence[] }>(`/cyber/cmmc-dashboard/domain/${encodeURIComponent(selectedDomain.name)}`)
        .then((r) => setDomainControls(r.data.controls))
        .catch(() => setDomainControls([]))
        .finally(() => setLoadingControls(false));
    } else {
      setDomainControls([]);
    }
  }, [selectedDomain]);

  useEffect(() => {
    if (!evidenceRequested || !data) return;
    setEvidenceLoading(true);
    const params = new URLSearchParams();
    if (evidenceFilters.domain) params.set('domain', evidenceFilters.domain);
    if (evidenceFilters.status) params.set('status', evidenceFilters.status);
    if (evidenceFilters.filename.trim()) params.set('filename', evidenceFilters.filename.trim());
    client
      .get<EvidenceExplorerData>(`/cyber/cmmc-dashboard/evidence?${params.toString()}`)
      .then((r) => setEvidenceData(r.data))
      .catch(() => setEvidenceData(null))
      .finally(() => setEvidenceLoading(false));
  }, [evidenceRequested, data, evidenceFilters.domain, evidenceFilters.status, evidenceFilters.filename]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading CMMC Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">{error ?? 'No data available'}</p>
          <p className="text-gray-400 text-sm">Upload an evidence bundle via Admin → CMMC Evidence to populate this dashboard.</p>
        </div>
      </div>
    );
  }

  const { summary, buckets, domains, bundleInfo } = data;

  const statusCards: StatusCard[] = [
    {
      label: 'Technically Enforced',
      count: summary.implemented,
      color: 'green',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400'
    },
    {
      label: 'Policy & Procedure',
      count: summary.governed,
      color: 'blue',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400'
    },
    {
      label: 'Cloud Provider',
      count: summary.inherited,
      color: 'purple',
      bgColor: 'bg-purple-500/10',
      textColor: 'text-purple-400'
    },
    {
      label: 'Formally Excluded',
      count: summary.notApplicable,
      color: 'gray',
      bgColor: 'bg-gray-500/10',
      textColor: 'text-gray-400'
    },
    {
      label: 'In Progress',
      count: summary.partiallyImplemented,
      color: 'amber',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-400'
    }
  ];

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  const truncateHash = (hash: string) => {
    if (!hash) return 'N/A';
    return hash.length > 16 ? `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}` : hash;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Section 1: Hero KPI Bar */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">CMMC Level 2 Posture</h1>
              <p className="text-gray-400 text-sm">
                Attestee: Brian MacDonald · System Owner · MacTech Solutions
              </p>
            </div>
            {bundleInfo && (
              <div className="text-right">
                <p className="text-gray-400 text-sm">Last ingested:</p>
                <p className="text-white font-medium">{formatDate(bundleInfo.ingestedAt)}</p>
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-baseline gap-4 mb-2">
              <span className="text-4xl font-bold">
                Adjudicated: {summary.adjudicated}/{summary.totalControls} ({summary.adjudicatedPercent}%)
              </span>
              <span className="text-gray-400">
                Outstanding: {summary.outstanding || summary.partiallyImplemented}
              </span>
            </div>
            <div className="h-4 bg-gray-700 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-teal-500 transition-all duration-1000 rounded-full"
                style={{ width: `${Math.min(100, summary.adjudicatedPercent)}%` }}
              />
            </div>
          </div>

          <div className="mb-4">
            <button
              type="button"
              onClick={() => {
                setEvidenceRequested(true);
                setTimeout(() => document.getElementById('evidence-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
              className="text-left group"
            >
              <p className="text-gray-400 text-sm mb-2 group-hover:text-teal-400 transition">
                <span className="underline decoration-dotted">{summary.totalEvidenceReferences.toLocaleString()} evidence references</span>
                {' · '}
                SHA-256 verified
              </p>
              <p className="text-gray-500 text-xs italic group-hover:text-gray-400 transition">
                (Control × file pairs; same file may be referenced by multiple controls) — View all
              </p>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-700">
            <span className="text-gray-400 text-sm">Closeout by bucket:</span>
            {buckets.map((bucket) => (
              <button
                key={bucket.name}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-sm font-medium transition"
                onClick={() => {
                  const element = document.getElementById('domain-grid');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {bucket.name} {bucket.implemented}/{bucket.total}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Status Breakdown Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {statusCards.map((card) => (
            <div
              key={card.label}
              className={`${card.bgColor} border border-gray-700 rounded-lg p-4 text-center`}
            >
              <div className={`${card.textColor} text-3xl font-bold mb-1`}>{card.count}</div>
              <div className="text-gray-400 text-xs">{card.label}</div>
              <div className={`w-2 h-2 ${card.textColor.replace('text-', 'bg-')} rounded-full mx-auto mt-2`}></div>
            </div>
          ))}
        </div>

        {/* Section 3: Domain Grid */}
        <div id="domain-grid">
          <h2 className="text-xl font-bold mb-6">Domain Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {domains.map((domain) => {
              const completed = domain.implemented + domain.governed + domain.inherited;
              const percent = domain.total > 0 ? Math.round((completed / domain.total) * 100) : 0;
              const circumference = 2 * Math.PI * 45; // radius = 45
              const offset = circumference - (percent / 100) * circumference;

              // Determine border color
              let borderColor = 'border-red-500';
              if (percent === 100) borderColor = 'border-green-500';
              else if (percent >= 50) borderColor = 'border-amber-500';

              return (
                <div
                  key={domain.name}
                  className={`bg-gray-800 border-l-4 ${borderColor} border border-gray-700 rounded-lg p-5 hover:scale-[1.02] hover:shadow-xl transition-all cursor-pointer`}
                  onClick={() => setSelectedDomain(domain)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-lg mb-1">{domain.name}</h3>
                      <p className="text-gray-400 text-xs">
                        NIST SP 800-171 {NIST_SECTION_MAP[domain.name] || ''}
                      </p>
                    </div>
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <svg className="transform -rotate-90 w-20 h-20">
                        <circle
                          cx="40"
                          cy="40"
                          r="35"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="none"
                          className="text-gray-700"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="35"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="none"
                          strokeDasharray={circumference}
                          strokeDashoffset={offset}
                          className={`${
                            percent === 100
                              ? 'text-green-500'
                              : percent >= 50
                              ? 'text-amber-500'
                              : 'text-red-500'
                          } transition-all duration-500`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold">{percent}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                      ✅ {domain.implemented}
                    </span>
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                      🏛️ {domain.governed}
                    </span>
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                      🤝 {domain.inherited}
                    </span>
                    <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
                      🚫 {domain.not_applicable}
                    </span>
                  </div>

                  <div className="text-gray-400 text-xs">
                    {domain.total} total controls · {domain.evidenceFiles} evidence references
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Evidence Explorer: full dynamic view of all evidence */}
        <div id="evidence-explorer" className="mt-12 pt-8 border-t border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold">Evidence Explorer</h2>
            {!evidenceRequested ? (
              <button
                type="button"
                onClick={() => setEvidenceRequested(true)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition"
              >
                Load all evidence
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">View:</span>
                <button
                  type="button"
                  onClick={() => setEvidenceViewMode('file')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${evidenceViewMode === 'file' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  By file
                </button>
                <button
                  type="button"
                  onClick={() => setEvidenceViewMode('reference')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${evidenceViewMode === 'reference' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  By reference
                </button>
              </div>
            )}
          </div>

          {evidenceRequested && (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Filter by filename..."
                  value={evidenceFilters.filename}
                  onChange={(e) => setEvidenceFilters((f) => ({ ...f, filename: e.target.value }))}
                  className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 w-48 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <select
                  value={evidenceFilters.domain}
                  onChange={(e) => setEvidenceFilters((f) => ({ ...f, domain: e.target.value }))}
                  className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">All domains</option>
                  {domains.map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={evidenceFilters.status}
                  onChange={(e) => setEvidenceFilters((f) => ({ ...f, status: e.target.value }))}
                  className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">All statuses</option>
                  <option value="implemented">Implemented</option>
                  <option value="governed">Governed</option>
                  <option value="inherited">Inherited</option>
                  <option value="partially_implemented">In Progress</option>
                  <option value="not_applicable">Not Applicable</option>
                </select>
                {(evidenceFilters.domain || evidenceFilters.status || evidenceFilters.filename.trim()) && (
                  <button
                    type="button"
                    onClick={() => setEvidenceFilters({ domain: '', status: '', filename: '' })}
                    className="px-3 py-2 text-gray-400 hover:text-white text-sm"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {evidenceLoading ? (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-400 mx-auto mb-3"></div>
                  <p className="text-gray-400">Loading evidence...</p>
                </div>
              ) : evidenceData ? (
                <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    {evidenceViewMode === 'file' ? (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-700/50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold text-gray-300">Filename</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-300">SHA-256</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-300">Controls</th>
                            <th className="px-4 py-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {evidenceData.uniqueFiles.map((f, idx) => (
                            <tr
                              key={`${f.filename}-${idx}`}
                              className="hover:bg-gray-700/30 transition"
                            >
                              <td className="px-4 py-2.5 font-mono text-gray-200 truncate max-w-xs" title={f.filename}>{f.filename}</td>
                              <td className="px-4 py-2.5 font-mono text-xs text-gray-500 truncate max-w-[12rem]" title={f.sha256 ?? ''}>{truncateHash(f.sha256 ?? '')}</td>
                              <td className="px-4 py-2.5 text-right text-gray-400">{f.control_count}</td>
                              <td className="px-4 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEvidenceFile({ filename: f.filename, sha256: f.sha256 });
                                    setSelectedEvidenceControlIds(f.control_ids);
                                  }}
                                  className="text-teal-400 hover:text-teal-300 text-sm"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-700/50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold text-gray-300">Control</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-300">Domain</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-300">Status</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-300">Filename</th>
                            <th className="px-4 py-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {evidenceData.references.map((r, idx) => (
                            <tr key={`${r.control_id}-${r.filename}-${idx}`} className="hover:bg-gray-700/30 transition">
                              <td className="px-4 py-2.5 font-mono text-gray-200">{r.control_id}</td>
                              <td className="px-4 py-2.5 text-gray-400">{r.domain}</td>
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  r.status === 'implemented' ? 'bg-green-500/20 text-green-400' :
                                  r.status === 'governed' ? 'bg-blue-500/20 text-blue-400' :
                                  r.status === 'inherited' ? 'bg-purple-500/20 text-purple-400' :
                                  r.status === 'partially_implemented' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>{r.status.replace(/_/g, ' ')}</span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-gray-300 truncate max-w-xs" title={r.filename}>{r.filename}</td>
                              <td className="px-4 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEvidenceFile({ filename: r.filename, sha256: r.sha256 });
                                    setSelectedEvidenceControlIds([r.control_id]);
                                  }}
                                  className="text-teal-400 hover:text-teal-300 text-sm"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="px-4 py-2 bg-gray-700/30 border-t border-gray-700 text-xs text-gray-500">
                    {evidenceViewMode === 'file'
                      ? `${evidenceData.uniqueFiles.length} unique file(s)`
                      : `${evidenceData.references.length} reference(s)`}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center text-gray-500">
                  No evidence data. Upload an evidence bundle via Admin → CMMC Evidence.
                </div>
              )}
            </>
          )}
        </div>

        {/* Bundle Info Footer */}
        {bundleInfo && (
          <div className="mt-12 pt-8 border-t border-gray-700">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Bundle Metadata</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Bundle Version</p>
                  <p className="text-white">{bundleInfo.bundleVersion || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Trust Codex Version</p>
                  <p className="text-white">{bundleInfo.trustCodexVersion || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Bundle Hash</p>
                  <p className="text-white font-mono text-xs">{truncateHash(bundleInfo.bundleHash)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Ingested At</p>
                  <p className="text-white">{formatDate(bundleInfo.ingestedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Slide-over Panel for Domain Details */}
        {selectedDomain && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => {
                setSelectedDomain(null);
                setSelectedEvidenceFile(null);
              }}
            ></div>
            <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-gray-800 border-l border-gray-700 shadow-2xl z-50 overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold">{selectedDomain.name}</h2>
                    <p className="text-gray-400 text-sm mt-1">
                      NIST SP 800-171 {NIST_SECTION_MAP[selectedDomain.name] || ''}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDomain(null);
                      setSelectedEvidenceFile(null);
                    }}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Domain Summary */}
                <div className="mb-6 grid grid-cols-2 gap-3">
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Total Controls</p>
                    <p className="text-2xl font-bold">{selectedDomain.total}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Evidence References</p>
                    <p className="text-2xl font-bold">{selectedDomain.evidenceFiles}</p>
                    <p className="text-xs text-gray-500 mt-1">(Control × file pairs)</p>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="mb-6">
                  <p className="text-gray-400 text-sm mb-3 font-semibold">Status Breakdown</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between bg-green-500/10 rounded p-2">
                      <span className="text-green-400 text-sm">✅ Implemented</span>
                      <span className="font-bold">{selectedDomain.implemented}</span>
                    </div>
                    <div className="flex items-center justify-between bg-blue-500/10 rounded p-2">
                      <span className="text-blue-400 text-sm">🏛️ Governed</span>
                      <span className="font-bold">{selectedDomain.governed}</span>
                    </div>
                    <div className="flex items-center justify-between bg-purple-500/10 rounded p-2">
                      <span className="text-purple-400 text-sm">🤝 Inherited</span>
                      <span className="font-bold">{selectedDomain.inherited}</span>
                    </div>
                    {selectedDomain.partially_implemented > 0 && (
                      <div className="flex items-center justify-between bg-amber-500/10 rounded p-2">
                        <span className="text-amber-400 text-sm">⚠️ In Progress</span>
                        <span className="font-bold">{selectedDomain.partially_implemented}</span>
                      </div>
                    )}
                    {selectedDomain.not_applicable > 0 && (
                      <div className="flex items-center justify-between bg-gray-500/10 rounded p-2">
                        <span className="text-gray-400 text-sm">🚫 Not Applicable</span>
                        <span className="font-bold">{selectedDomain.not_applicable}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Controls List */}
                <div>
                  <p className="text-gray-400 text-sm mb-3 font-semibold">Controls ({domainControls.length})</p>
                  {loadingControls ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400 mx-auto mb-2"></div>
                      <p className="text-gray-400 text-sm">Loading controls...</p>
                    </div>
                  ) : domainControls.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-8">No controls found</p>
                  ) : (
                    <div className="space-y-3">
                      {domainControls.map((control) => {
                        const getStatusColor = (status: string) => {
                          switch (status) {
                            case 'implemented':
                              return 'bg-green-500/20 text-green-400 border-green-500/30';
                            case 'governed':
                              return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                            case 'inherited':
                              return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
                            case 'partially_implemented':
                              return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                            case 'not_applicable':
                              return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
                            default:
                              return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
                          }
                        };

                        const getStatusLabel = (status: string) => {
                          switch (status) {
                            case 'implemented':
                              return '✅ Implemented';
                            case 'governed':
                              return '🏛️ Governed';
                            case 'inherited':
                              return '🤝 Inherited';
                            case 'partially_implemented':
                              return '⚠️ In Progress';
                            case 'not_applicable':
                              return '🚫 N/A';
                            default:
                              return status;
                          }
                        };

                        const evidenceFiles = Array.isArray(control.evidence_files) ? control.evidence_files : [];

                        return (
                          <div
                            key={control.control_id}
                            className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 hover:bg-gray-700/50 transition"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-white text-sm mb-1">{control.control_id}</h4>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(control.status)}`}>
                                    {getStatusLabel(control.status)}
                                  </span>
                                  {control.class && (
                                    <span className="px-2 py-0.5 rounded text-xs bg-gray-600/50 text-gray-300 border border-gray-500/30">
                                      Class {control.class}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <p className="text-xs text-gray-400 mb-2">
                                Evidence References: {evidenceFiles.length}
                              </p>
                              {evidenceFiles.length > 0 ? (
                                <div className="space-y-1">
                                  {evidenceFiles.slice(0, 3).map((ev: { filename: string; sha256: string | null }, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        setSelectedEvidenceFile(ev);
                                        setSelectedEvidenceControlIds([control.control_id]);
                                      }}
                                      className="w-full text-left px-2 py-1.5 bg-gray-600/30 hover:bg-gray-600/50 rounded text-xs text-gray-300 hover:text-white transition flex items-center justify-between group"
                                    >
                                      <span className="truncate flex-1">{ev.filename}</span>
                                      <span className="ml-2 text-gray-500 group-hover:text-gray-400">→</span>
                                    </button>
                                  ))}
                                  {evidenceFiles.length > 3 && (
                                    <p className="text-xs text-gray-500 px-2">
                                      +{evidenceFiles.length - 3} more
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 px-2">No evidence files</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Evidence File Detail Modal */}
        {selectedEvidenceFile && (
          <>
            <div
              className="fixed inset-0 bg-black/70 z-50"
              onClick={() => { setSelectedEvidenceFile(null); setSelectedEvidenceControlIds(null); }}
            ></div>
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Evidence File</h3>
                    <button
                      onClick={() => { setSelectedEvidenceFile(null); setSelectedEvidenceControlIds(null); }}
                      className="text-gray-400 hover:text-white text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Filename</p>
                      <p className="text-white font-mono text-sm break-all">{selectedEvidenceFile.filename}</p>
                    </div>
                    {selectedEvidenceFile.sha256 && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">SHA-256 Hash</p>
                        <p className="text-white font-mono text-xs break-all">{selectedEvidenceFile.sha256}</p>
                      </div>
                    )}
                    {selectedEvidenceControlIds && selectedEvidenceControlIds.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">
                          Referenced by {selectedEvidenceControlIds.length} control{selectedEvidenceControlIds.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedEvidenceControlIds.map((cid) => (
                            <span
                              key={cid}
                              className="px-2 py-1 bg-gray-700/50 rounded text-xs font-mono text-gray-300"
                            >{cid}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-4 border-t border-gray-700">
                      <p className="text-sm text-gray-400">
                        This evidence file is stored in the evidence bundle ZIP. To view the contents,
                        extract the bundle and navigate to the <code className="bg-gray-700/50 px-1 rounded">evidence/</code> directory
                        (or <code className="bg-gray-700/50 px-1 rounded">evidence/azure/</code>, <code className="bg-gray-700/50 px-1 rounded">evidence/governance/</code> for subfolders).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
