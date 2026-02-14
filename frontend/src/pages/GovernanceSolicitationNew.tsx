import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

const CONTRACT_TYPES = ['FFP', 'T&M', 'Cost-Reimbursable', 'IDIQ', 'BPA', 'Other'];
const CMMC_LEVELS = ['None', 'L1', 'L2', 'L3'];

export default function GovernanceSolicitationNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    solicitation_number: '',
    title: '',
    agency: '',
    naics_code: '',
    contract_type: 'FFP',
    est_value: '',
    cui_involved: false,
    cmmc_level: 'None',
    set_aside_type: '',
    due_date: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await client.post('/governance/solicitations', {
        ...form,
        est_value: form.est_value ? parseFloat(form.est_value) : undefined,
        due_date: form.due_date || undefined
      });
      navigate(`/governance-engine/solicitations/${data.id}/review`);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">New Solicitation</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Solicitation Number *</label>
          <input
            type="text"
            required
            value={form.solicitation_number}
            onChange={(e) => setForm({ ...form, solicitation_number: e.target.value })}
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
              value={form.contract_type}
              onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-blue"
            >
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Est. Value</label>
            <input
              type="number"
              value={form.est_value}
              onChange={(e) => setForm({ ...form, est_value: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-blue"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">NAICS</label>
            <input
              type="text"
              value={form.naics_code}
              onChange={(e) => setForm({ ...form, naics_code: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CMMC Level</label>
            <select
              value={form.cmmc_level}
              onChange={(e) => setForm({ ...form, cmmc_level: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-blue"
            >
              {CMMC_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="cui"
            checked={form.cui_involved}
            onChange={(e) => setForm({ ...form, cui_involved: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="cui" className="text-sm">CUI Involved?</label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-blue"
          />
        </div>
        <div className="flex gap-4 pt-4">
          <button type="submit" disabled={loading} className="px-6 py-2 bg-gov-blue text-white rounded-lg font-medium hover:bg-gov-blue-light disabled:opacity-50">
            {loading ? 'Creating...' : 'Create & Review'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
