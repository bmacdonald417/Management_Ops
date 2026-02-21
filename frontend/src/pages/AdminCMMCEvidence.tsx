import { useEffect, useState } from 'react';
import client from '../api/client';

interface IngestLogRow {
  id: number;
  ingest_timestamp: string;
  status: string;
  bundle_version: string | null;
  trust_codex_version: string | null;
  bundle_hash: string | null;
  ingested_by_name: string | null;
}

export default function AdminCMMCEvidence() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [log, setLog] = useState<IngestLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLog = () => {
    client
      .get('/cyber/ingest-log')
      .then((r) => setLog((r.data?.rows ?? []) as IngestLogRow[]))
      .catch(() => setLog([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLog();
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setMessage('');
    const fd = new FormData();
    fd.append('bundle', file);
    try {
      await client.post('/cyber/ingest-evidence-bundle', fd);
      setStatus('success');
      setMessage('Ingest successful!');
      setFile(null);
      loadLog();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setStatus('error');
      setMessage(e.response?.data?.error ?? 'Upload failed');
    }
  };

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">CMMC Evidence Ingest</h1>
      <p className="text-slate-600 mb-6">
        Upload the evidence-bundle.zip from Trust Codex. The bundle will be cryptographically verified and the platform&apos;s CMMC control status updated.
      </p>

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm mb-8">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Evidence bundle (.zip)</label>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f ?? null);
                setStatus('idle');
                setMessage('');
              }}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gov-blue file:text-white file:font-medium hover:file:opacity-90"
            />
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || status === 'uploading'}
            className="px-4 py-2 bg-gov-blue text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'uploading' ? 'Uploading...' : 'Upload and Ingest Bundle'}
          </button>
        </div>
        {status === 'success' && <p className="mt-4 text-green-600 font-medium">{message}</p>}
        {status === 'error' && <p className="mt-4 text-red-600 font-medium">Error: {message}</p>}
      </div>

      <div>
        <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Ingest History</h2>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Bundle Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trust Codex Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ingested By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {log.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No ingest attempts yet.
                    </td>
                  </tr>
                ) : (
                  log.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {new Date(row.ingest_timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            row.status === 'SUCCESS'
                              ? 'bg-green-100 text-green-800'
                              : row.status.startsWith('FAILURE')
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{row.bundle_version ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{row.trust_codex_version ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{row.ingested_by_name ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
