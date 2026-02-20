/**
 * Phase 3 + 5: Governance Doctrine — Completeness Index (sticky, filter), Copilot panel, responsive.
 */
import { useEffect, useState, useRef, useMemo } from 'react';
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

interface GovernanceDoctrineDoc {
  id: string;
  title: string;
  version: string;
  purpose: string | null;
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
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [copilotPanelSectionId, setCopilotPanelSectionId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadList = () => {
    client.get('/governance-doctrine')
      .then((r) => setList((r.data ?? []) as GovernanceDoctrineDoc[]))
      .catch(() => setList([]));
  };

  const loadDoctrine = (id: string) => {
    setLoading(true);
    Promise.all([
      client.get(`/governance-doctrine/${id}`),
      client.get(`/governance-doctrine/${id}/completeness`)
    ])
      .then(([docRes, compRes]) => {
        setDoctrine(docRes.data as GovernanceDoctrineDoc);
        setCompleteness(compRes.data as CompletenessIndex);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (list.length > 0 && !doctrine) loadDoctrine(list[0].id);
    else if (list.length === 0) setLoading(false);
  }, [list]);

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
        setCopilotPanelSectionId(sectionId);
        setSuggestionsLoading(null);
      })
      .catch(() => setSuggestionsLoading(null));
  };

  const applyCopilotSuggestion = (text: string, mode: 'insert' | 'append' | 'replace') => {
    if (!copilotPanelSectionId || !doctrine) return;
    const sec = doctrine.sections.find((s) => s.id === copilotPanelSectionId);
    const current = editingSectionId === copilotPanelSectionId ? editingContent : (sec?.content ?? '');
    const next = mode === 'replace' ? text : (current + (current ? '\n\n' : '') + text);
    setEditingSectionId(copilotPanelSectionId);
    setEditingContent(next);
  };

  const markComplete = (sectionId: string) => {
    client.post(`/governance-doctrine/sections/${sectionId}/complete`, {})
      .then(() => doctrine && loadDoctrine(doctrine.id));
  };

  const jumpToSection = (sectionId: string) => {
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth' });
  };

  const completenessFiltered = useMemo(() => {
    if (!completeness) return null;
    if (!showIncompleteOnly) return completeness;
    return {
      ...completeness,
      sections: completeness.sections.filter((s) => !s.isComplete)
    };
  }, [completeness, showIncompleteOnly]);

  if (loading && list.length > 0 && !doctrine) {
    return <div className="text-slate-500">Loading doctrine...</div>;
  }

  if (list.length === 0 && !createMode) {
    return (
      <div>
        <h1 className="font-display font-bold text-2xl text-gov-navy mb-4">Governance & Risk Doctrine</h1>
        <p className="text-slate-600 mb-4">No doctrine document yet. Create one to build your governance and risk doctrine and track completeness.</p>
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
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-1">{doctrine.title}</h1>
      <p className="text-slate-600 text-sm mb-6">Version {doctrine.version}{doctrine.purpose ? ` · ${doctrine.purpose}` : ''}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div id="completeness" className="lg:col-span-1 lg:sticky lg:top-4 self-start">
          {completenessFiltered && (
            <>
              <label className="flex items-center gap-2 mb-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showIncompleteOnly}
                  onChange={(e) => setShowIncompleteOnly(e.target.checked)}
                />
                Show incomplete only
              </label>
              <CompletenessIndexWidget data={completenessFiltered} onJumpToSection={jumpToSection} />
            </>
          )}
        </div>
        <div id="sections" className="lg:col-span-2 space-y-6">
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              placeholder="Section number (e.g. 1.1)"
              value={newSectionNumber}
              onChange={(e) => setNewSectionNumber(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 w-24"
            />
            <input
              type="text"
              placeholder="Section title"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSection()}
              className="border border-slate-300 rounded-lg px-3 py-2 flex-1 min-w-[200px]"
            />
            <button onClick={addSection} disabled={saving} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">Add section</button>
          </div>

          {doctrine.sections
            .sort((a, b) => a.order - b.order)
            .map((sec) => (
              <div
                key={sec.id}
                ref={(el) => { sectionRefs.current[sec.id] = el; }}
                className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3 className="font-medium text-gov-navy">
                    {sec.section_number} {sec.title}
                    {sec.required && <span className="ml-2 text-xs text-amber-600">Required</span>}
                  </h3>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => getSuggestions(sec.id, false)}
                      disabled={!!suggestionsLoading}
                      className="text-sm text-gov-blue hover:underline disabled:opacity-50"
                    >
                      {suggestionsLoading === sec.id ? '…' : 'Get suggestions'}
                    </button>
                    <button
                      type="button"
                      onClick={() => getSuggestions(sec.id, true)}
                      disabled={!!suggestionsLoading}
                      className="text-sm text-slate-600 hover:underline disabled:opacity-50"
                    >
                      Get & save
                    </button>
                    {!sec.is_complete && (
                      <button type="button" onClick={() => markComplete(sec.id)} className="text-sm text-green-600 hover:underline">Mark complete</button>
                    )}
                    {editingSectionId !== sec.id ? (
                      <button type="button" onClick={() => { setEditingSectionId(sec.id); setEditingContent(sec.content ?? ''); }} className="text-sm text-slate-600 hover:underline">Edit</button>
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
                    rows={8}
                    className="w-full border border-slate-300 rounded-lg p-3 text-sm"
                  />
                ) : (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{sec.content || '—'}</div>
                )}
                {copilotPanelSectionId !== sec.id && Array.isArray(sec.copilot_suggestions) && sec.copilot_suggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <button type="button" onClick={() => setCopilotPanelSectionId(sec.id)} className="text-sm text-gov-blue hover:underline">Open suggestions in panel</button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {copilotPanelSectionId && doctrine && (() => {
        const sec = doctrine.sections.find((s) => s.id === copilotPanelSectionId);
        const suggestions = (sec?.copilot_suggestions ?? []) as string[];
        if (suggestions.length === 0) return null;
        return (
          <div className="fixed right-4 top-24 bottom-24 w-96 max-w-[calc(100vw-2rem)] z-10">
            <CopilotSuggestionsPanel
              suggestions={suggestions}
              onClose={() => setCopilotPanelSectionId(null)}
              onApply={applyCopilotSuggestion}
              visible
            />
          </div>
        );
      })()}
    </div>
  );
}
