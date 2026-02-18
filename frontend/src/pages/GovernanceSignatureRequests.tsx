/**
 * Signature Requests — items pending cryptographic approval.
 * Sign with Ed25519; QMS can verify without changing its hashing.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

interface SignatureRequest {
  id: string;
  recordType: string;
  recordId: string;
  recordVersion: number;
  qmsHash: string;
  title: string;
  approvalType?: string;
}

export default function GovernanceSignatureRequests() {
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [signingConfigured, setSigningConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    recordType: 'CLAUSE_ASSESSMENT',
    recordId: '',
    recordVersion: 1,
    qmsHash: '',
    title: '',
    approvalType: 'CLAUSE_ASSESSMENT'
  });

  const load = () => {
    client.get('/signatures/requests').then((r) => {
      setRequests(r.data.requests ?? []);
      setSigningConfigured(r.data.signingConfigured ?? false);
    }).catch(() => setRequests([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSign = async (id: string) => {
    setSigningId(id);
    try {
      await client.post(`/signatures/requests/${id}/sign`);
      load();
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Sign failed');
    } finally {
      setSigningId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.post('/signatures/requests', createForm);
      setShowCreate(false);
      setCreateForm({ recordType: 'CLAUSE_ASSESSMENT', recordId: '', recordVersion: 1, qmsHash: '', title: '', approvalType: 'CLAUSE_ASSESSMENT' });
      load();
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Create failed');
    }
  };

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Signature Requests</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            Add Request
          </button>
          <Link to="/governance-engine" className="px-4 py-2 text-gov-blue hover:underline text-sm">
            ← Dashboard
          </Link>
        </div>
      </div>

      {!signingConfigured && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          Signing not configured. Set GOV_ED25519_PRIVATE_KEY in environment.
        </div>
      )}

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-slate-500">
          No items pending signature. Add a request or they will appear when QMS form records are finalized.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Record</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Title</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">QMS Hash</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 text-sm">
                    <span className="font-mono">{r.recordType}</span> / {r.recordId} v{r.recordVersion}
                  </td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate">{r.title}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600 truncate max-w-[120px]" title={r.qmsHash}>{r.qmsHash}</td>
                  <td className="px-4 py-3 text-sm">{r.approvalType ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSign(r.id)}
                      disabled={!signingConfigured || signingId === r.id}
                      className="px-3 py-1.5 bg-gov-blue text-white rounded-lg text-sm font-medium hover:bg-gov-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {signingId === r.id ? 'Signing…' : 'Sign'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowCreate(false)} aria-hidden="true" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Add Signature Request</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Record Type</label>
                  <input
                    value={createForm.recordType}
                    onChange={(e) => setCreateForm({ ...createForm, recordType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Record ID</label>
                  <input
                    value={createForm.recordId}
                    onChange={(e) => setCreateForm({ ...createForm, recordId: e.target.value })}
                    placeholder="e.g. qms-form-record-uuid"
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Record Version</label>
                  <input
                    type="number"
                    value={createForm.recordVersion}
                    onChange={(e) => setCreateForm({ ...createForm, recordVersion: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">QMS Hash</label>
                  <input
                    value={createForm.qmsHash}
                    onChange={(e) => setCreateForm({ ...createForm, qmsHash: e.target.value })}
                    placeholder="Hash from QMS record"
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="Clause assessment title"
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
                    Create
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
