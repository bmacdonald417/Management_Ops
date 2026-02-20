/**
 * Phase 2: Proposal detail — sections, forms, Copilot suggestions, generate document.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';

interface ProposalSection {
  id: string;
  title: string;
  content: string | null;
  order: number;
  copilot_suggestions: string[] | null;
}

interface ProposalForm {
  id: string;
  form_name: string;
  form_data: Record<string, unknown>;
  status: string;
  qms_document_id: string;
  completed_qms_document_id?: string | null;
  download_url?: string | null;
}

interface Proposal {
  id: string;
  title: string;
  status: string;
  proposal_type: string;
  submission_deadline: string | null;
  solicitation_id: string | null;
  solicitation_title?: string;
  solicitation_number?: string;
  sections: ProposalSection[];
  forms: ProposalForm[];
}

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionContent, setEditingSectionContent] = useState('');
  const [formTemplates, setFormTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [formTemplateSelect, setFormTemplateSelect] = useState('');
  const [newFormName, setNewFormName] = useState('');
  const [newFormQmsId, setNewFormQmsId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const load = () => {
    if (!id) return;
    client.get(`/proposals/${id}`)
      .then((r) => { setProposal(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    client.get('/qms/form-templates')
      .then((r) => setFormTemplates((r.data?.templates ?? []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name || t.id }))))
      .catch(() => setFormTemplates([]));
  }, []);

  const updateProposal = (patch: Partial<Proposal>) => {
    if (!id) return;
    setSaving(true);
    client.put(`/proposals/${id}`, patch)
      .then((r) => { setProposal((p) => (p ? { ...p, ...r.data } : null)); setSaving(false); })
      .catch(() => setSaving(false));
  };

  const addSection = () => {
    if (!id || !newSectionTitle.trim()) return;
    setSaving(true);
    client.post(`/proposals/${id}/sections`, { title: newSectionTitle.trim() })
      .then(() => { setNewSectionTitle(''); load(); setSaving(false); })
      .catch(() => setSaving(false));
  };

  const updateSection = (sectionId: string, data: { title?: string; content?: string }) => {
    setSaving(true);
    client.put(`/proposals/sections/${sectionId}`, data)
      .then(() => { load(); setEditingSectionId(null); setSaving(false); })
      .catch(() => setSaving(false));
  };

  const deleteSection = (sectionId: string) => {
    if (!confirm('Delete this section?')) return;
    client.delete(`/proposals/sections/${sectionId}`).then(() => load());
  };

  const getSuggestions = (sectionId: string, save: boolean) => {
    setSuggestionsLoading(sectionId);
    client.post(`/proposals/sections/${sectionId}/suggestions${save ? '?save=true' : ''}`)
      .then((r) => {
        const suggestions = (r.data?.suggestions ?? []) as string[];
        setProposal((p) => {
          if (!p) return p;
          return {
            ...p,
            sections: p.sections.map((s) =>
              s.id === sectionId ? { ...s, copilot_suggestions: suggestions } : s
            )
          };
        });
        setSuggestionsLoading(null);
      })
      .catch(() => setSuggestionsLoading(null));
  };

  const addForm = () => {
    const qmsId = formTemplateSelect || newFormQmsId.trim() || (formTemplates.length === 0 ? '' : '');
    const name = newFormName.trim() || (formTemplates.find((t) => t.id === qmsId)?.name) || qmsId;
    if (!id) return;
    if (!qmsId) {
      const prompted = window.prompt('QMS document/template ID:', '');
      if (!prompted) return;
      setSaving(true);
      client.post(`/proposals/${id}/forms`, { formName: name || prompted, qmsDocumentId: prompted, formData: {} })
        .then(() => { setShowAddForm(false); setFormTemplateSelect(''); setNewFormName(''); setNewFormQmsId(''); load(); setSaving(false); })
        .catch(() => setSaving(false));
      return;
    }
    setSaving(true);
    client.post(`/proposals/${id}/forms`, { formName: name, qmsDocumentId: qmsId, formData: {} })
      .then(() => { setShowAddForm(false); setFormTemplateSelect(''); setNewFormName(''); setNewFormQmsId(''); load(); setSaving(false); })
      .catch(() => setSaving(false));
  };

  const downloadCompletedForm = (formId: string) => {
    client.get(`/proposals/forms/${formId}/download-completed`, { responseType: 'blob' })
      .then((r) => {
        const blob = r.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `completed-form-${formId.slice(0, 8)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => {
        if (e.response?.status === 302 && e.response?.headers?.location) {
          window.open(e.response.headers.location, '_blank');
        } else {
          console.error(e);
          alert(e.response?.data?.error || 'Download failed');
        }
      });
  };

  const updateFormData = (formId: string, formData: Record<string, unknown>) => {
    client.put(`/proposals/forms/${formId}`, { formData }).then(() => load());
  };

  const generateDocument = () => {
    if (!id) return;
    setGenerateLoading(true);
    client.post(`/proposals/${id}/generate`, null, { responseType: 'blob' })
      .then((r) => {
        const blob = r.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (proposal?.title || 'proposal').replace(/[^a-zA-Z0-9_-]/g, '_') + '.html';
        a.click();
        URL.revokeObjectURL(url);
        setGenerateLoading(false);
      })
      .catch(() => setGenerateLoading(false));
  };

  if (loading || !proposal) {
    return <div className="text-slate-500">{loading ? 'Loading...' : 'Proposal not found.'}</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <Link to="/governance-engine/proposals" className="text-sm text-gov-blue hover:underline">← Proposals</Link>
      </div>

      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-gov-navy">{proposal.title}</h1>
          <p className="text-slate-600 mt-1">
            {proposal.proposal_type} · {proposal.status}
            {proposal.solicitation_number && (
              <> · <Link to={`/governance-engine/solicitations/${proposal.solicitation_id}/engine`} className="text-gov-blue hover:underline">{proposal.solicitation_number}</Link></>
            )}
          </p>
          {proposal.submission_deadline && (
            <p className="text-sm text-slate-500 mt-1">Deadline: {new Date(proposal.submission_deadline).toLocaleDateString()}</p>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={proposal.status}
            onChange={(e) => updateProposal({ status: e.target.value })}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="DRAFT">Draft</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="AWARDED">Awarded</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button
            onClick={generateDocument}
            disabled={generateLoading}
            className="px-4 py-2 bg-gov-blue text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {generateLoading ? 'Generating…' : 'Generate Proposal'}
          </button>
        </div>
      </div>

      {/* Sections */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gov-navy mb-3">Sections</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="New section title"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSection()}
            className="border border-slate-300 rounded-lg px-3 py-2 flex-1 max-w-md"
          />
          <button onClick={addSection} disabled={saving} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            Add Section
          </button>
        </div>
        <div className="space-y-4">
          {proposal.sections
            .sort((a, b) => a.order - b.order)
            .map((sec) => (
              <div key={sec.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-gov-navy">{sec.title}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => getSuggestions(sec.id, false)}
                      disabled={!!suggestionsLoading}
                      className="text-sm text-gov-blue hover:underline disabled:opacity-50"
                    >
                      {suggestionsLoading === sec.id ? 'Loading…' : 'Get Copilot Suggestions'}
                    </button>
                    <button
                      onClick={() => getSuggestions(sec.id, true)}
                      disabled={!!suggestionsLoading}
                      className="text-sm text-slate-600 hover:underline disabled:opacity-50"
                    >
                      Get & Save
                    </button>
                    {editingSectionId !== sec.id ? (
                      <button onClick={() => { setEditingSectionId(sec.id); setEditingSectionContent(sec.content ?? ''); }} className="text-sm text-slate-600 hover:underline">Edit</button>
                    ) : (
                      <button onClick={() => updateSection(sec.id, { content: editingSectionContent })} className="text-sm text-gov-blue hover:underline">Save</button>
                    )}
                    <button onClick={() => deleteSection(sec.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
                {editingSectionId === sec.id ? (
                  <textarea
                    value={editingSectionContent}
                    onChange={(e) => setEditingSectionContent(e.target.value)}
                    rows={6}
                    className="w-full border border-slate-300 rounded-lg p-3 text-sm"
                  />
                ) : (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{sec.content || '—'}</div>
                )}
                {Array.isArray(sec.copilot_suggestions) && sec.copilot_suggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1">Copilot suggestions</p>
                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                      {sec.copilot_suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
        </div>
      </section>

      {/* Forms */}
      <section>
        <h2 className="text-lg font-semibold text-gov-navy mb-3">Forms</h2>
        {!showAddForm ? (
          <button onClick={() => setShowAddForm(true)} disabled={saving} className="mb-3 px-4 py-2 border border-gov-blue text-gov-blue rounded-lg text-sm font-medium hover:bg-gov-blue hover:text-white disabled:opacity-50">
            Add Form
          </button>
        ) : (
          <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg inline-block">
            <label className="block text-sm font-medium text-slate-700 mb-1">QMS form template</label>
            {formTemplates.length > 0 ? (
              <select
                value={formTemplateSelect}
                onChange={(e) => setFormTemplateSelect(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm mr-2"
              >
                <option value="">— Select or enter ID below —</option>
                {formTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name || t.id}</option>
                ))}
              </select>
            ) : null}
            {formTemplates.length === 0 && <span className="text-xs text-slate-500 mr-2">(No templates from QMS; enter ID below)</span>}
            <input
              type="text"
              placeholder="QMS template ID (if not in list)"
              value={newFormQmsId}
              onChange={(e) => setNewFormQmsId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm mr-2 mt-1"
            />
            <input
              type="text"
              placeholder="Form name (e.g. MAC-FRM-013)"
              value={newFormName}
              onChange={(e) => setNewFormName(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm mr-2 mt-1"
            />
            <button onClick={addForm} disabled={saving} className="px-3 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium disabled:opacity-50">Add</button>
            <button type="button" onClick={() => { setShowAddForm(false); setFormTemplateSelect(''); setNewFormName(''); setNewFormQmsId(''); }} className="ml-2 text-sm text-slate-600 hover:underline">Cancel</button>
          </div>
        )}
        <div className="space-y-3">
          {proposal.forms.map((f) => (
            <div key={f.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="font-medium">{f.form_name}</span>
                <span className="text-xs px-2 py-1 rounded bg-slate-100">{f.status}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">QMS template: {f.qms_document_id}</p>
              <div className="mt-2 text-sm text-slate-600">
                {Object.keys(f.form_data || {}).length === 0 ? 'No data yet' : JSON.stringify(f.form_data)}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => updateFormData(f.id, { ...(f.form_data || {}), lastEdited: new Date().toISOString() })} className="text-sm text-gov-blue hover:underline">
                  Edit form data
                </button>
                {(f.completed_qms_document_id || f.download_url) && (
                  <button onClick={() => downloadCompletedForm(f.id)} className="text-sm text-gov-blue hover:underline font-medium">
                    Download completed form
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
