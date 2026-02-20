/**
 * Phase 5: Copilot suggestions panel — insert, append, replace, copy.
 * Works with textarea/content state; parent provides onApply(content, mode).
 */
interface CopilotSuggestionsPanelProps {
  suggestions: string[];
  onClose: () => void;
  onApply: (content: string, mode: 'insert' | 'append' | 'replace') => void;
  visible?: boolean;
}

export default function CopilotSuggestionsPanel({
  suggestions,
  onClose,
  onApply,
  visible = true
}: CopilotSuggestionsPanelProps) {
  if (!visible || suggestions.length === 0) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 max-h-[70vh] overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gov-navy">Copilot suggestions</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <ul className="space-y-3 overflow-y-auto flex-1 pr-1">
        {suggestions.map((text, i) => (
          <li key={i} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
            <p className="text-sm text-slate-700 whitespace-pre-wrap mb-2 line-clamp-4">{text}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onApply(text, 'insert')}
                className="px-2 py-1 bg-gov-blue text-white rounded text-xs font-medium hover:opacity-90"
              >
                Insert
              </button>
              <button
                type="button"
                onClick={() => onApply(text, 'append')}
                className="px-2 py-1 bg-slate-600 text-white rounded text-xs font-medium hover:opacity-90"
              >
                Append
              </button>
              <button
                type="button"
                onClick={() => onApply(text, 'replace')}
                className="px-2 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:opacity-90"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(text)}
                className="px-2 py-1 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Copy
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
