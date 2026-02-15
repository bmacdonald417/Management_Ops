/**
 * Create solicitation via Governance Engine (new API).
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';

const CONTRACT_TYPES = ['FFP', 'CR', 'T&M', 'LH', 'BPA', 'IDIQ', 'Other'];

export default function GovernanceSolicitationEngineNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    solicitationNumber: '',
    title: '',
    agency: '',
    customer: '',
    setAside: '',
    contractType: 'FFP',
    anticipatedValue: '',
    periodOfPerformance: '',
    dueDate: '',
    sourceUrl: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await client.post('/solicitations', {
        solicitationNumber: form.solicitationNumber,
        title: form.title,
        agency: form.agency,
        customer: form.customer || undefined,
        setAside: form.setAside || undefined,
        contractType: form.contractType,
        anticipatedValue: form.anticipatedValue ? parseFloat(form.anticipatedValue) : undefined,
        periodOfPerformance: form.periodOfPerformance || undefined,
        dueDate: form.dueDate || undefined,
        sourceUrl: form.sourceUrl || undefined
      });
      navigate(`/governance-engine/solicitations/${data.id}/engine`);
    } catch (err) {
      console.error(err);
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Link to="/governance-engine/solicitations" className="text-sm text-gov-blue hover:underline mb-4 inline-block">← Back to Solicitations</Link>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">New Solicitation (Governance Engine)</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Solicitation Number *</label>
          <input
            type="text"
            required
            value={form.solicitationNumber}
            onChange={(e) => setForm({ ...form, solicitationNumber: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-blue"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-blue"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Agency *</label>
          <input
            type="text"
            required
            value={form.agency}
            onChange={(e) => setForm({ ...form, agency: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-blue"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contract Type *</label>
            <select
              value={form.contractType}
              onChange={(e) => setForm({ ...form, contractType: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            >
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Anticipated Value</label>
            <input
              type="number"
              value={form.anticipatedValue}
              onChange={(e) => setForm({ ...form, anticipatedValue: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
            <input
              type="text"
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Set-Aside</label>
            <input
              type="text"
              value={form.setAside}
              onChange={(e) => setForm({ ...form, setAside: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Period of Performance</label>
            <input
              type="text"
              value={form.periodOfPerformance}
              onChange={(e) => setForm({ ...form, periodOfPerformance: e.target.value })}
              placeholder="e.g. 12 months"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Source URL</label>
          <input
            type="url"
            value={form.sourceUrl}
            onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
            placeholder="https://..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <div className="flex gap-4 pt-4">
          <button type="submit" disabled={loading} className="px-6 py-2 bg-gov-blue text-white rounded-lg font-medium hover:bg-gov-blue-light disabled:opacity-50">
            {loading ? 'Creating...' : 'Create & Start Clause Review'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
