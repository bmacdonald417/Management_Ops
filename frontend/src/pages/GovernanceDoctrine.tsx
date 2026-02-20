/**
 * Phase 2: Governance Builder — split-pane side-by-side assistance tool.
 * Left: Working Document (Markdown editor). Right: Doctrine Requirements + Suggested Text.
 * Maps 11 Contract Lifecycle phases; version control per Section 1.6.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import client from '../api/client';
import CompletenessIndexWidget from '../components/governance/CompletenessIndexWidget';
import CopilotSuggestionsPanel from '../components/copilot/CopilotSuggestionsPanel';

interface DoctrineSection {
  id: string;
  section_number: string;
  title: string;
  content: string | null;
  order: number;
  required: boolean;
  copilot_suggestions: string[] | null;
  is_complete?: boolean;
  completed_at?: string | null;
}

interface LifecyclePhase {
  sectionNumber: string;
  title: string;
  requirement: string;
  order: number;
}

interface GovernanceDoctrineDoc {
  id: string;
  title: string;
  version: string;
  purpose: string | null;
  revision_date?: string | null;
  approval_placeholder?: string | null;
  sections: DoctrineSection[];
}

interface CompletenessIndex {
  totalSections: number;
  completedSections: number;
  completenessPercentage: number;
  sections: Array<{ id: string; sectionNumber: string; title: string; isComplete: boolean; required: boolean }>;
}

export default function GovernanceDoctrine() {
  const [list, setList] = useState<GovernanceDoctrineDoc[]>([]);
  const [doctrine, setDoctrine] = useState<GovernanceDoctrineDoc | null>(null);
  const [completeness, setCompleteness] = useState<CompletenessIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newVersion, setNewVersion] = useState('1.0');
  const [newPurpose, setNewPurpose] = useState('');
  const [newSectionNumber, setNewSectionNumber] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [phases, setPhases] = useState<LifecyclePhase[]>([]);
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [showCopilotPanel, setShowCopilotPanel] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadList = () => {
    client.get('/governance-doctrine')
      .then((r) => setList((r.data ?? []) as GovernanceDoctrineDoc[]))
      .catch(() => setList([]));
  };

  const loadDoctrine = useCallback((id: string) => {
    setLoading(true);
    Promise.all([
      client.get(`/governance-doctrine/${id}`),
      client.get(`/governance-doctrine/${id}/completeness`),
      client.get('/governance-doctrine/lifecycle-phases')
    ])
      .then(([docRes, compRes, phasesRes]) => {
        setDoctrine(docRes.data as GovernanceDoctrineDoc);
        setCompleteness(compRes.data as CompletenessIndex);
        setPhases((phasesRes.data?.phases ?? []) as LifecyclePhase[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (list.length > 0 && !doctrine) loadDoctrine(list[0].id);
    else if (list.length === 0) setLoading(false);
  }, [list, doctrine, loadDoctrine]);

  const createDoctrine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    client.post('/governance-doctrine', { title: newTitle.trim(), version: newVersion.trim() || '1.0', purpose: newPurpose.trim() || undefined })
      .then((r) => {
        const created = r.data as GovernanceDoctrineDoc;
        setList((prev) => [created, ...prev]);
        setDoctrine(created);
        setCompleteness({ totalSections: 0, completedSections: 0, completenessPercentage: 0, sections: [] });
        setCreateMode(false);
        setNewTitle('');
        setNewPurpose('');
        setSaving(false);
      })
      .catch(() => setSaving(false));
  };

  const addSection = () => {
    if (!doctrine || !newSectionNumber.trim() || !newSectionTitle.trim()) return;
    setSaving(true);
    client.post(`/governance-doctrine/${doctrine.id}/sections`, {
      sectionNumber: newSectionNumber.trim(),
      title: newSectionTitle.trim(),
      order: doctrine.sections.length
    })
      .then(() => {
        loadDoctrine(doctrine.id);
        setNewSectionNumber('');
        setNewSectionTitle('');
        setSaving(false);
      })
      .catch(() => setSaving(false));
  };

  const updateSection = (sectionId: string, data: { title?: string; content?: string }) => {
    setSaving(true);
    client.put(`/governance-doctrine/sections/${sectionId}`, data)
      .then(() => { if (doctrine) loadDoctrine(doctrine.id); setEditingSectionId(null); setSaving(false); })
      .catch(() => setSaving(false));
  };

  const updateDoctrineMeta = (data: { version?: string; revision_date?: string; approval_placeholder?: string }) => {
    if (!doctrine) return;
    setSaving(true);
    client.put(`/governance-doctrine/${doctrine.id}`, data)
      .then(() => { loadDoctrine(doctrine.id); setSaving(false); })
      .catch(() => setSaving(false));
  };

  const deleteSection = (sectionId: string) => {
    if (!confirm('Delete this section?')) return;
    client.delete(`/governance-doctrine/sections/${sectionId}`).then(() => doctrine && loadDoctrine(doctrine.id));
  };

  const getSuggestions = (sectionId: string, save: boolean) => {
    setSuggestionsLoading(sectionId);
    client.post(`/governance-doctrine/sections/${sectionId}/suggestions${save ? '?save=true' : ''}`)
      .then((r) => {
        const suggestions = (r.data?.suggestions ?? []) as string[];
        setDoctrine((d) => {
          if (!d) return d;
          return {
            ...d,
            sections: d.sections.map((s) =>
              s.id === sectionId ? { ...s, copilot_suggestions: suggestions } : s
            )
          };
        });
        setActiveSectionId(sectionId);
        setShowCopilotPanel(true);
        setSuggestionsLoading(null);
      })
      .catch(() => setSuggestionsLoading(null));
  };

  const applyCopilotSuggestion = (text: string, mode: 'insert' | 'append' | 'replace') => {
    if (!activeSectionId || !doctrine) return;
    const sec = doctrine.sections.find((s) => s.id === activeSectionId);
    const current = editingSectionId === activeSectionId ? editingContent : (sec?.content ?? '');
    const next = mode === 'replace' ? text : (current + (current ? '\n\n' : '') + text);
    setEditingSectionId(activeSectionId);
    setEditingContent(next);
  };

  const markComplete = (sectionId: string) => {
    client.post(`/governance-doctrine/sections/${sectionId}/complete`, {})
      .then(() => doctrine && loadDoctrine(doctrine.id));
  };

  const jumpToSection = (sectionId: string) => {
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth' });
  };

  const getPhaseForSection = (sectionNumber: string): LifecyclePhase | undefined =>
    phases.find((p) => p.sectionNumber === sectionNumber) ||
    phases.find((p) => sectionNumber.startsWith(p.sectionNumber + '.'));

  const activeSection = doctrine?.sections.find((s) => s.id === activeSectionId);
  const activePhase = activeSection ? getPhaseForSection(activeSection.section_number) : null;

  const completenessFiltered = completeness
    ? showIncompleteOnly
      ? { ...completeness, sections: completeness.sections.filter((s) => !s.isComplete) }
      : completeness
    : null;

  const exportControlledDocument = () => {
    if (!doctrine) return;
    const revDate = doctrine.revision_date || new Date().toISOString().slice(0, 10);
    const approval = doctrine.approval_placeholder || 'Approved by: ___________  Date: ___________';
    const header = `# ${doctrine.title}\n\n**Version:** ${doctrine.version}  |  **Revision Date:** ${revDate}\n\n**Approval:** ${approval}\n\n---\n\n`;
    const body = doctrine.sections
      .sort((a, b) => a.order - b.order)
      .map((s) => `## ${s.section_number} ${s.title}\n\n${s.content || '_[Empty]_'}`)
      .join('\n\n');
    const blob = new Blob([header + body], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `doctrine-${doctrine.title.replace(/\s+/g, '-')}-v${doctrine.version}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading && list.length > 0 && !doctrine) {
    return <div className="text-slate-500">Loading doctrine...</div>;
  }

  if (list.length === 0 && !createMode) {
    return (
      <div>
        <h1 className="font-display font-bold text-2xl text-gov-navy mb-4">Governance Builder</h1>
        <p className="text-slate-600 mb-4">Create a controlled governance document aligned with the Contract Lifecycle Governance Framework.</p>
        <button onClick={() => setCreateMode(true)} className="px-4 py-2 bg-gov-blue text-white rounded-lg font-medium hover:opacity-90">
          Create doctrine
        </button>
      </div>
    );
  }

  if (createMode) {
    return (
      <div>
        <h1 className="font-display font-bold text-2xl text-gov-navy mb-4">Create Governance Doctrine</h1>
        <form onSubmit={createDoctrine} className="max-w-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="e.g. Federal Contract Governance & Risk Management Manual" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
            <input type="text" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Purpose (optional)</label>
            <textarea value={newPurpose} onChange={(e) => setNewPurpose(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-gov-blue text-white rounded-lg font-medium disabled:opacity-50">Create</button>
            <button type="button" onClick={() => setCreateMode(false)} className="px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  if (!doctrine) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Document selector + metadata */}
      <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-slate-200">
        <select
          value={doctrine.id}
          onChange={(e) => loadDoctrine(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 font-medium text-gov-navy"
        >
          {list.map((d) => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
        <span className="text-sm text-slate-600">
          Version <input type="text" defaultValue={doctrine.version} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== doctrine.version) updateDoctrineMeta({ version: v }); }} key={doctrine.id + doctrine.version} className="w-16 border-b border-slate-300 bg-transparent text-center" />
        </span>
        <span className="text-sm text-slate-600">
          Revision: <input type="date" value={doctrine.revision_date || ''} onChange={(e) => updateDoctrineMeta({ revision_date: e.target.value || undefined })} className="border border-slate-300 rounded px-2 py-1" />
        </span>
        <span className="text-sm text-slate-600">
          Approval: <input type="text" defaultValue={doctrine.approval_placeholder || ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (doctrine.approval_placeholder || '')) updateDoctrineMeta({ approval_placeholder: v || undefined }); }} key={doctrine.id + (doctrine.approval_placeholder || '')} placeholder="Approved by: ___  Date: ___" className="border border-slate-300 rounded px-2 py-1 w-48" />
        </span>
        <button onClick={exportControlledDocument} className="ml-auto px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
          Export controlled document
        </button>
      </div>

      {/* Split-pane layout */}
      <div className="flex flex-1 min-h-0 gap-4">
        {/* Left: Working Document */}
        <div className="flex-1 flex flex-col min-w-0 border border-slate-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 font-medium text-gov-navy">Working Document</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex gap-2 items-center flex-wrap mb-4">
              <input type="text" placeholder="Section (e.g. 2.2)" value={newSectionNumber} onChange={(e) => setNewSectionNumber(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 w-24 text-sm" />
              <input type="text" placeholder="Title" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSection()} className="border border-slate-300 rounded-lg px-3 py-2 flex-1 min-w-[160px] text-sm" />
              <button onClick={addSection} disabled={saving} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">Add section</button>
            </div>
            {doctrine.sections
              .sort((a, b) => a.order - b.order)
              .map((sec) => (
                <div
                  key={sec.id}
                  ref={(el) => { sectionRefs.current[sec.id] = el; }}
                  className={`border rounded-lg p-4 transition ${activeSectionId === sec.id ? 'border-gov-blue ring-1 ring-gov-blue' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-medium text-gov-navy cursor-pointer" onClick={() => { setActiveSectionId(sec.id); setShowCopilotPanel(false); }}>
                      {sec.section_number} {sec.title}
                      {sec.required && <span className="ml-2 text-xs text-amber-600">Required</span>}
                    </h3>
                    <div className="flex gap-2 flex-shrink-0">
                      <button type="button" onClick={() => { setActiveSectionId(sec.id); getSuggestions(sec.id, false); }} disabled={!!suggestionsLoading} className="text-sm text-gov-blue hover:underline disabled:opacity-50">
                        {suggestionsLoading === sec.id ? '…' : 'Get suggestions'}
                      </button>
                      {!sec.is_complete && (
                        <button type="button" onClick={() => markComplete(sec.id)} className="text-sm text-green-600 hover:underline">Mark complete</button>
                      )}
                      {editingSectionId !== sec.id ? (
                        <button type="button" onClick={() => { setEditingSectionId(sec.id); setEditingContent(sec.content ?? ''); setActiveSectionId(sec.id); }} className="text-sm text-slate-600 hover:underline">Edit</button>
                      ) : (
                        <button type="button" onClick={() => updateSection(sec.id, { content: editingContent })} className="text-sm text-gov-blue hover:underline">Save</button>
                      )}
                      <button type="button" onClick={() => deleteSection(sec.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                    </div>
                  </div>
                  {editingSectionId === sec.id ? (
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      rows={6}
                      className="w-full border border-slate-300 rounded-lg p-3 text-sm font-mono"
                      placeholder="Markdown supported..."
                    />
                  ) : (
                    <div className="text-sm text-slate-700 whitespace-pre-wrap font-mono">{sec.content || '—'}</div>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Right: Assistance Panel */}
        <div className="w-96 flex-shrink-0 flex flex-col border border-slate-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 font-medium text-gov-navy">Assistance Panel</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {completenessFiltered && (
              <div>
                <label className="flex items-center gap-2 mb-2 text-sm text-slate-600">
                  <input type="checkbox" checked={showIncompleteOnly} onChange={(e) => setShowIncompleteOnly(e.target.checked)} />
                  Show incomplete only
                </label>
                <CompletenessIndexWidget data={completenessFiltered} onJumpToSection={jumpToSection} />
              </div>
            )}
            {activeSection && (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Doctrine Requirement</h4>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
                    {activePhase ? activePhase.requirement : `Section ${activeSection.section_number} — No mapped requirement. Add a matching lifecycle phase (e.g. 2.2, 2.3) for contextual guidance.`}
                  </p>
                  {activePhase && <p className="text-xs text-slate-500 mt-1">Phase {activePhase.sectionNumber}: {activePhase.title}</p>}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Suggested Text</h4>
                  {Array.isArray(activeSection.copilot_suggestions) && activeSection.copilot_suggestions.length > 0 ? (
                    <ul className="space-y-2">
                      {(activeSection.copilot_suggestions as string[]).map((s, i) => (
                        <li key={i} className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">{s.slice(0, 200)}{s.length > 200 ? '…' : ''}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">Click &quot;Get suggestions&quot; to generate AI-assisted content for this section.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => getSuggestions(activeSection.id, false)} disabled={!!suggestionsLoading} className="text-sm text-gov-blue hover:underline disabled:opacity-50">
                    Get suggestions
                  </button>
                  <button type="button" onClick={() => getSuggestions(activeSection.id, true)} disabled={!!suggestionsLoading} className="text-sm text-slate-600 hover:underline disabled:opacity-50">
                    Get & save
                  </button>
                  {Array.isArray(activeSection.copilot_suggestions) && (activeSection.copilot_suggestions as string[]).length > 0 && (
                    <button type="button" onClick={() => setShowCopilotPanel(true)} className="text-sm text-gov-blue hover:underline">
                      Open apply panel
                    </button>
                  )}
                </div>
              </>
            )}
            {!activeSection && doctrine.sections.length > 0 && (
              <p className="text-sm text-slate-500">Select a section to see doctrine requirements and suggested text.</p>
            )}
            {doctrine.sections.length === 0 && (
              <p className="text-sm text-slate-500">Add sections to build your doctrine. Use section numbers from the Contract Lifecycle Framework (1.1, 2.2, 2.3, etc.).</p>
            )}
          </div>
        </div>
      </div>

      {/* Copilot apply panel (overlay when suggestions exist) */}
      {showCopilotPanel && activeSectionId && doctrine && (() => {
        const sec = doctrine.sections.find((s) => s.id === activeSectionId);
        const suggestions = (sec?.copilot_suggestions ?? []) as string[];
        if (suggestions.length === 0) return null;
        return (
          <div className="fixed right-4 top-24 bottom-24 w-96 max-w-[calc(100vw-2rem)] z-20 border border-slate-200 rounded-lg shadow-xl bg-white">
            <CopilotSuggestionsPanel
              suggestions={suggestions}
              onClose={() => setShowCopilotPanel(false)}
              onApply={applyCopilotSuggestion}
              visible
            />
          </div>
        );
      })()}
    </div>
  );
}
