interface EscalationPillProps {
  type: 'Cyber' | 'Financial' | 'Indemnification' | 'Audit';
}

const colors: Record<string, string> = {
  Cyber: 'bg-purple-100 text-purple-800',
  Financial: 'bg-amber-100 text-amber-800',
  Indemnification: 'bg-rose-100 text-rose-800',
  Audit: 'bg-blue-100 text-blue-800'
};

export default function EscalationPill({ type }: EscalationPillProps) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${colors[type] ?? 'bg-slate-100'}`}>
      {type}
    </span>
  );
}
