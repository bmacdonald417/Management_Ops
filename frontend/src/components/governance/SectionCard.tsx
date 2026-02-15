import { Link } from 'react-router-dom';

interface ImproveLink {
  label: string;
  href: string;
  reason: string;
}

interface SectionCardProps {
  id: string;
  title: string;
  level: string;
  score: number;
  gaps: string[];
  improveLinks: ImproveLink[];
  onCopilotClick?: () => void;
}

function scoreColor(pct: number): string {
  if (pct < 50) return 'text-red-600 bg-red-50';
  if (pct < 75) return 'text-amber-600 bg-amber-50';
  return 'text-green-600 bg-green-50';
}

export default function SectionCard({ id, title, level, score, gaps, improveLinks, onCopilotClick }: SectionCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border border-slate-100 hover:border-gov-blue/30 transition">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gov-navy">{id} {title}</h3>
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${scoreColor(score)}`}>{level}</span>
      </div>
      <div className="text-2xl font-bold text-gov-navy mb-2">{score}%</div>
      {gaps.length > 0 && (
        <ul className="text-sm text-slate-600 mb-2 space-y-1">
          {gaps.slice(0, 3).map((g, i) => (
            <li key={i}>• {g}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        {onCopilotClick && (
          <button onClick={onCopilotClick} className="text-sm text-gov-blue hover:underline">
            AI Copilot →
          </button>
        )}
        {improveLinks.slice(0, 2).map((l, i) => (
          <Link key={i} to={l.href} className="text-sm text-gov-blue hover:underline">
            {l.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
