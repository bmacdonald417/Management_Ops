interface RiskBadgeProps {
  level: number;
  size?: 'sm' | 'md';
}

const colors: Record<number, string> = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-orange-100 text-orange-800',
  4: 'bg-red-100 text-red-800'
};

export default function RiskBadge({ level, size = 'md' }: RiskBadgeProps) {
  return (
    <span className={`inline-flex items-center font-medium rounded ${colors[level] ?? 'bg-slate-100'} ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}>
      L{level}
    </span>
  );
}
