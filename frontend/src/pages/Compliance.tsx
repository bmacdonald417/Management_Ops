import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import RiskBadge from '../components/governance/RiskBadge';

interface Clause {
  id: string;
  clause_number: string;
  title: string;
  type: string;
  category: string | null;
  suggested_risk_level: number | null;
  flow_down: string;
  flow_down_notes: string | null;
  default_financial: number;
  default_cyber: number;
  default_liability: number;
  default_regulatory: number;
  default_performance: number;
  notes: string | null;
  active: boolean;
}

const TYPES = ['FAR', 'DFARS', 'AGENCY', 'OTHER'];
const CATEGORIES = [
  'TERMINATION', 'CHANGES', 'AUDIT_RECORDS', 'CYBER_CUI', 'INSURANCE', 'INDEMNIFICATION',
  'LABOR', 'SMALL_BUSINESS', 'PROPERTY', 'IP_DATA_RIGHTS', 'OCI_ETHICS', 'TRADE_COMPLIANCE',
  'FUNDING_PAYMENT', 'OTHER'
];
const FLOW_DOWN = ['YES', 'NO', 'CONDITIONAL'];

function formatCategory(cat: string | null): string {
  if (!cat) return '—';
  return cat.replace(/_/g, ' ');
}

export default function Compliance() {
  const { user } = useAuth();
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [constants, setConstants] = useState<{ types: string[]; categories: string[]; flowDown: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const typeFilter = searchParams.get('regulation') ?? searchParams.get('type') ?? '';
  const categoryFilter = searchParams.get('category') ?? '';
  const flowDownFilter = searchParams.get('flow_down') ?? '';
  const activeFilter = searchParams.get('active') ?? '';
  const riskFilter = searchParams.get('risk_level') ?? '';

  const canEdit = ['Level 1', 'Level 3'].includes(user?.role ?? '');

  const applyFilters = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    setSearchParams(next);
  };

  useEffect(() => {
    client.get('/compliance/library/constants').then((r) => setConstants(r.data));
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (typeFilter) params.regulation = typeFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (flowDownFilter) params.flow_down = flowDownFilter;
    if (activeFilter) params.active = activeFilter;
    if (riskFilter) params.risk_level = riskFilter;
    if (searchInput) params.search = searchInput;

    setLoading(true);
    client.get('/compliance/library', { params }).then((r) => {
      setClauses(r.data);
      setLoading(false);
    });
  }, [typeFilter, categoryFilter, flowDownFilter, activeFilter, riskFilter, searchInput]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await client.post('/compliance/library/seed');
      const params: Record<string, string> = {};
      if (typeFilter) params.regulation = typeFilter;
      if (searchInput) params.search = searchInput;
      const r = await client.get('/compliance/library', { params });
      setClauses(r.data);
    } catch (e) {
      alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">Clause Library</h1>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="search"
            placeholder="Search clause number or title..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-64 px-4 py-2 border border-slate-300 rounded-lg"
          />
          <select
            value={typeFilter}
            onChange={(e) => applyFilters({ regulation: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">All Types</option>
            <option value="FAR">FAR</option>
            <option value="DFARS">DFARS</option>
            <option value="AGENCY">Agency</option>
            <option value="OTHER">Other</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => applyFilters({ category: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{formatCategory(c)}</option>
            ))}
          </select>
          <select
            value={flowDownFilter}
            onChange={(e) => applyFilters({ flow_down: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">All Flow-down</option>
            <option value="YES">Yes</option>
            <option value="NO">No</option>
            <option value="CONDITIONAL">Conditional</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activeFilter !== 'false'}
              onChange={(e) => applyFilters({ active: e.target.checked ? '' : 'false' })}
            />
            Active only
          </label>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium"
            >
              Add Clause
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => applyFilters({ regulation: '', risk_level: '' })}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${!typeFilter && !riskFilter ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}
          >
            All
          </button>
          <button
            onClick={() => applyFilters({ regulation: 'FAR', risk_level: '' })}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${typeFilter === 'FAR' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}
          >
            FAR
          </button>
          <button
            onClick={() => applyFilters({ regulation: 'DFARS', risk_level: '' })}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${typeFilter === 'DFARS' ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}
          >
            DFARS
          </button>
          {[1, 2, 3, 4].map((l) => (
            <button
              key={l}
              onClick={() => applyFilters({ risk_level: String(l), regulation: typeFilter })}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${riskFilter === String(l) ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}
            >
              Risk L{l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-100">
          {clauses.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p className="mb-4">No clauses found.</p>
              {canEdit && (
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="px-6 py-2 bg-gov-blue text-white rounded-lg font-medium"
                >
                  {seeding ? 'Seeding...' : 'Run Starter Pack Seed'}
                </button>
              )}
              <p className="mt-4 text-sm">Run db.seed for full import later.</p>
            </div>
          ) : (
            <>
              {canEdit && clauses.length < 20 && (
                <div className="px-4 py-2 bg-slate-50 border-b flex justify-between items-center">
                  <span className="text-sm text-slate-600">Starter pack has {clauses.length} clauses. Add more or run seed again.</span>
                  <button onClick={handleSeed} disabled={seeding} className="text-sm text-gov-blue hover:underline">
                    {seeding ? 'Seeding...' : 'Run Starter Pack Seed'}
                  </button>
                </div>
              )}
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clause</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Risk</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Flow-down</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Active</th>
                    {canEdit && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {clauses.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => { setSelectedClause(c); }}
                    >
                      <td className="px-6 py-4 font-mono font-medium">{c.clause_number}</td>
                      <td className="px-6 py-4 text-sm max-w-xs truncate">{c.title}</td>
                      <td className="px-6 py-4 text-sm">{c.type}</td>
                      <td className="px-6 py-4 text-sm">{formatCategory(c.category)}</td>
                      <td className="px-6 py-4">
                        <RiskBadge level={c.suggested_risk_level ?? 1} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-sm" title={c.flow_down_notes ?? ''}>
                        {c.flow_down === 'YES' ? 'Yes' : c.flow_down === 'NO' ? 'No' : 'Conditional'}
                        {c.flow_down_notes && <span className="text-slate-400 ml-1">ⓘ</span>}
                      </td>
                      <td className="px-6 py-4 text-sm">{c.active ? 'Yes' : 'No'}</td>
                      {canEdit && (
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => { setShowEditModal(true); setSelectedClause(c); }}
                            className="text-gov-blue hover:underline text-sm"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {selectedClause && (
        <ClauseDrawer
          clause={selectedClause}
          onClose={() => setSelectedClause(null)}
          onEdit={() => { setShowEditModal(true); }}
          canEdit={canEdit}
        />
      )}

      {showAddModal && (
        <ClauseModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); client.get('/compliance/library', { params: { regulation: typeFilter, category: categoryFilter, flow_down: flowDownFilter, active: activeFilter, risk_level: riskFilter, search: searchInput } }).then((r) => setClauses(r.data)); }}
          constants={constants}
        />
      )}

      {showEditModal && selectedClause && (
        <ClauseModal
          clause={selectedClause}
          onClose={() => { setShowEditModal(false); setSelectedClause(null); }}
          onSaved={() => { setShowEditModal(false); setSelectedClause(null); client.get('/compliance/library', { params: { regulation: typeFilter, category: categoryFilter, flow_down: flowDownFilter, active: activeFilter, risk_level: riskFilter, search: searchInput } }).then((r) => setClauses(r.data)); }}
          constants={constants}
        />
      )}
    </div>
  );
}

function ClauseDrawer({ clause, onClose, onEdit, canEdit }: { clause: Clause; onClose: () => void; onEdit: () => void; canEdit: boolean }) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="font-display font-semibold text-lg">Clause Details</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Clause Number</dt>
              <dd className="font-mono flex items-center gap-2">
                {clause.clause_number}
                <button onClick={() => copyToClipboard(clause.clause_number)} className="text-gov-blue text-xs hover:underline">Copy</button>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Title</dt>
              <dd className="flex items-center gap-2">
                {clause.title}
                <button onClick={() => copyToClipboard(clause.title)} className="text-gov-blue text-xs hover:underline">Copy</button>
              </dd>
            </div>
            <div><dt className="text-slate-500">Type</dt><dd>{clause.type}</dd></div>
            <div><dt className="text-slate-500">Category</dt><dd>{formatCategory(clause.category)}</dd></div>
            <div><dt className="text-slate-500">Risk Level</dt><dd><RiskBadge level={clause.suggested_risk_level ?? 1} /></dd></div>
            <div><dt className="text-slate-500">Flow-down</dt><dd>{clause.flow_down} {clause.flow_down_notes && `(${clause.flow_down_notes})`}</dd></div>
            <div><dt className="text-slate-500">Scoring Presets</dt><dd>F:{clause.default_financial} C:{clause.default_cyber} L:{clause.default_liability} R:{clause.default_regulatory} P:{clause.default_performance}</dd></div>
            {clause.notes && <div><dt className="text-slate-500">Notes</dt><dd>{clause.notes}</dd></div>}
          </dl>
          {canEdit && (
            <button onClick={onEdit} className="mt-4 px-4 py-2 bg-gov-blue text-white rounded-lg text-sm">
              Edit Clause
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ClauseModal({
  clause,
  onClose,
  onSaved,
  constants
}: {
  clause?: Clause;
  onClose: () => void;
  onSaved: () => void;
  constants: { types: string[]; categories: string[]; flowDown: string[] } | null;
}) {
  const [form, setForm] = useState({
    clause_number: clause?.clause_number ?? '',
    title: clause?.title ?? '',
    type: clause?.type ?? 'FAR',
    category: clause?.category ?? '',
    default_financial: clause?.default_financial ?? 2,
    default_cyber: clause?.default_cyber ?? 2,
    default_liability: clause?.default_liability ?? 2,
    default_regulatory: clause?.default_regulatory ?? 2,
    default_performance: clause?.default_performance ?? 2,
    suggested_risk_level: clause?.suggested_risk_level ?? 2,
    flow_down: clause?.flow_down ?? 'CONDITIONAL',
    flow_down_notes: clause?.flow_down_notes ?? '',
    notes: clause?.notes ?? '',
    active: clause?.active ?? true
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        flow_down_notes: form.flow_down_notes || undefined,
        notes: form.notes || undefined,
        category: form.category || undefined
      };
      if (clause) {
        await client.put(`/compliance/library/${clause.id}`, payload);
      } else {
        await client.post('/compliance/library', payload);
      }
      onSaved();
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const types = constants?.types ?? TYPES;
  const categories = constants?.categories ?? CATEGORIES;
  const flowDown = constants?.flowDown ?? FLOW_DOWN;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display font-semibold text-lg mb-4">{clause ? 'Edit Clause' : 'Add Clause'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Clause Number *</label>
            <input
              type="text"
              value={form.clause_number}
              onChange={(e) => setForm({ ...form, clause_number: e.target.value })}
              placeholder="52.215-2 or 252.204-7012"
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                <option value="">—</option>
                {categories.map((c) => <option key={c} value={c}>{formatCategory(c)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Scoring Presets (1–5)</label>
            <div className="flex gap-2">
              {(['default_financial', 'default_cyber', 'default_liability', 'default_regulatory', 'default_performance'] as const).map((k, i) => (
                <div key={k}>
                  <span className="text-xs text-slate-500">{'FCLRP'[i]}</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: parseInt(e.target.value, 10) })}
                    className="w-12 px-1 py-1 border rounded text-center"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Suggested Risk</label>
              <select value={form.suggested_risk_level} onChange={(e) => setForm({ ...form, suggested_risk_level: parseInt(e.target.value, 10) })} className="w-full px-4 py-2 border rounded-lg">
                {[1, 2, 3, 4].map((l) => <option key={l} value={l}>L{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Flow-down</label>
              <select value={form.flow_down} onChange={(e) => setForm({ ...form, flow_down: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                {flowDown.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Flow-down Notes</label>
            <input type="text" value={form.flow_down_notes} onChange={(e) => setForm({ ...form, flow_down_notes: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows={2} />
          </div>
          {clause && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span className="text-sm">Active</span>
            </label>
          )}
          <div className="flex gap-2 pt-4">
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-gov-blue text-white rounded-lg font-medium">
              {submitting ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-2 bg-slate-200 rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
