/**
 * Phase 3: Completeness Index widget for Governance Doctrine.
 * Shows progress bar and section list with status badges; links to section by id for scroll.
 */
interface SectionItem {
  id: string;
  sectionNumber: string;
  title: string;
  isComplete: boolean;
  required: boolean;
}

interface CompletenessData {
  totalSections: number;
  completedSections: number;
  completenessPercentage: number;
  sections: SectionItem[];
}

interface CompletenessIndexWidgetProps {
  data: CompletenessData;
  onJumpToSection?: (sectionId: string) => void;
}

export default function CompletenessIndexWidget({ data, onJumpToSection }: CompletenessIndexWidgetProps) {
  const { totalSections, completedSections, completenessPercentage, sections } = data;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gov-navy mb-3">Completeness Index</h3>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gov-blue rounded-full transition-all"
            style={{ width: `${completenessPercentage}%` }}
          />
        </div>
        <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
          {completedSections} / {totalSections} ({completenessPercentage}%)
        </span>
      </div>
      <ul className="space-y-1.5">
        {sections.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            {onJumpToSection ? (
              <button
                type="button"
                onClick={() => onJumpToSection(s.id)}
                className="text-left flex-1 flex items-center gap-2 py-1 rounded hover:bg-slate-50 text-slate-700"
              >
                <span className="font-mono text-slate-500 w-8">{s.sectionNumber}</span>
                <span className="truncate">{s.title}</span>
              </button>
            ) : (
              <>
                <span className="font-mono text-slate-500 w-8">{s.sectionNumber}</span>
                <span className="truncate flex-1">{s.title}</span>
              </>
            )}
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${
                s.isComplete ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {s.isComplete ? 'Complete' : 'In progress'}
            </span>
            {s.required && !s.isComplete && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-600">Required</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
