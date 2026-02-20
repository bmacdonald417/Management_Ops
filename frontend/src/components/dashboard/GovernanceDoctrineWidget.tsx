/**
 * Phase 5: Governance Doctrine summary widget for the unified dashboard.
 * Shows completeness %, incomplete sections, and quick link to edit doctrine.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';

interface DoctrineDoc {
  id: string;
  title: string;
  version: string;
}

interface Completeness {
  totalSections: number;
  completedSections: number;
  completenessPercentage: number;
  sections: Array<{ id: string; sectionNumber: string; title: string; isComplete: boolean; required: boolean }>;
}

export default function GovernanceDoctrineWidget() {
  const [list, setList] = useState<DoctrineDoc[]>([]);
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/governance-doctrine')
      .then((r) => {
        const docs = (Array.isArray(r.data) ? r.data : []) as DoctrineDoc[];
        setList(docs);
        if (docs.length > 0) {
          return client.get(`/governance-doctrine/${docs[0].id}/completeness`);
        }
        return null;
      })
      .then((res) => {
        if (res?.data) setCompleteness(res.data as Completeness);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
        <h2 className="font-display font-semibold text-lg text-gov-navy mb-3">Governance Doctrine</h2>
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  const pct = completeness?.completenessPercentage ?? 0;
  const total = completeness?.totalSections ?? 0;
  const completed = completeness?.completedSections ?? 0;
  const incomplete = (completeness?.sections ?? []).filter((s) => !s.isComplete);
  const critical = incomplete.filter((s) => s.required).slice(0, 3);

  return (
    <div className="bg-white rounded-xl shadow p-6 border border-slate-100 hover:border-gov-blue/30 transition-colors">
      <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Governance Doctrine</h2>
      {list.length === 0 ? (
        <p className="text-slate-600 text-sm mb-4">No doctrine document yet. Create one to define governance and track completeness.</p>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gov-blue rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
              {completed} / {total} ({pct}%)
            </span>
          </div>
          {critical.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 mb-2">Critical incomplete (required)</p>
              <ul className="space-y-1 text-sm text-slate-700">
                {critical.map((s) => (
                  <li key={s.id} className="truncate">
                    {s.sectionNumber} {s.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <div className="pt-2 border-t border-slate-100">
        <Link to="/governance-engine/doctrine" className="inline-block px-3 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium hover:opacity-90">
          {list.length === 0 ? 'Create Doctrine' : 'Edit Doctrine'}
        </Link>
      </div>
    </div>
  );
}
