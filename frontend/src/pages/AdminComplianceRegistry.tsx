import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

interface DataSource {
  id: string;
  name: string;
  category: string;
  version: string;
  effectiveDate?: string;
  fileName?: string;
  recordCount: number;
  validationStatus: string;
  importedAt: string;
  isActive: boolean;
}

interface RegistryStats {
  clauseMasterCount: number;
  cyberControlMasterCount: number;
  costAccountCount: number;
  clauseMasterMeetsThreshold: boolean;
  cyberControlMeetsThreshold: boolean;
  costAccountExists: boolean;
}

const CATEGORIES = ['FAR', 'DFARS', 'CMMC', 'NIST', 'ISO', 'INSURANCE', 'COST_ACCOUNT', 'INTERNAL'];

export default function AdminComplianceRegistry() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [form, setForm] = useState({ category: 'FAR', version: '', name: '', effectiveDate: '' });
  const [file, setFile] = useState<File | null>(null);

  const load = () => {
    Promise.all([
      client.get('/admin/compliance-registry/sources'),
      client.get('/admin/compliance-registry/stats')
    ]).then(([r1, r2]) => {
      setSources(r1.data);
      setStats(r2.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleActivate = async (id: string) => {
    try {
      await client.post(`/admin/compliance-registry/sources/${id}/activate`);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error ?? 'Failed to activate');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !form.version.trim() || !form.name.trim()) {
      setUploadError('Name, version, and file are required');
      return;
    }
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', form.category);
    fd.append('version', form.version.trim());
    fd.append('name', form.name.trim());
    if (form.effectiveDate) fd.append('effectiveDate', form.effectiveDate);
    try {
      const r = await client.post('/admin/compliance-registry/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (r.data.validationStatus === 'INVALID') {
        setUploadError(`Validation failed: ${r.data.errors?.length ?? 0} error(s). Check error log.`);
      }
      setFile(null);
      setForm({ ...form, version: '', name: '', effectiveDate: '' });
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setUploadError(e.response?.data?.error ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading && !stats) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Compliance Data Registry</h1>
        <Link to="/governance-engine/auto-builder" className="text-gov-blue hover:underline">← Auto-Builder</Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">ClauseMaster</div>
            <div className={`text-2xl font-bold ${stats.clauseMasterMeetsThreshold ? 'text-green-600' : 'text-amber-600'}`}>
              {stats.clauseMasterCount} <span className="text-sm">(≥20)</span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">CyberControlMaster</div>
            <div className={`text-2xl font-bold ${stats.cyberControlMeetsThreshold ? 'text-green-600' : 'text-amber-600'}`}>
              {stats.cyberControlMasterCount} <span className="text-sm">(≥110)</span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">CostAccount</div>
            <div className={`text-2xl font-bold ${stats.costAccountExists ? 'text-green-600' : 'text-amber-600'}`}>
              {stats.costAccountCount}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Upload CSV</h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. FAR Clause Library v2026"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
            <input
              type="text"
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              placeholder="e.g. 2026.1"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date (optional)</label>
            <input
              type="date"
              value={form.effectiveDate}
              onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CSV File</label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full"
            />
          </div>
          {uploadError && <p className="text-red-600 text-sm">{uploadError}</p>}
          <button type="submit" disabled={uploading} className="px-4 py-2 bg-gov-blue text-white rounded-lg font-medium disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Data Sources</h2>
        {sources.length === 0 ? (
          <p className="text-slate-500">No data sources imported yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Version</th>
                  <th className="text-left py-2">Records</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Active</th>
                  <th className="text-left py-2">Imported</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2">{s.category}</td>
                    <td className="py-2">{s.version}</td>
                    <td className="py-2">{s.recordCount}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${s.validationStatus === 'VALID' ? 'bg-green-100 text-green-700' : s.validationStatus === 'INVALID' ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>
                        {s.validationStatus}
                      </span>
                    </td>
                    <td className="py-2">{s.isActive ? '✓' : ''}</td>
                    <td className="py-2 text-slate-500">{new Date(s.importedAt).toLocaleDateString()}</td>
                    <td className="py-2">
                      {s.validationStatus === 'VALID' && !s.isActive && (
                        <button onClick={() => handleActivate(s.id)} className="text-gov-blue hover:underline text-sm">
                          Activate
                        </button>
                      )}
                      {s.validationStatus === 'INVALID' && (
                        <Link to={`#errors-${s.id}`} className="text-amber-600 hover:underline text-sm">View errors</Link>
                      )}
                    </td>
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
