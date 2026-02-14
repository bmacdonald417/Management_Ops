interface MaturityBannerProps {
  gci: number;
  dci: number;
  pillars: { name: string; value: number }[];
}

function scoreColor(pct: number): string {
  if (pct < 50) return 'text-red-600';
  if (pct < 75) return 'text-amber-600';
  return 'text-green-600';
}

function scoreBg(pct: number): string {
  if (pct < 50) return 'bg-red-500';
  if (pct < 75) return 'bg-amber-500';
  return 'bg-green-500';
}

export default function MaturityBanner({ gci, dci, pillars }: MaturityBannerProps) {
  return (
    <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
      <div className="flex flex-wrap gap-6 items-center">
        <div>
          <div className="text-sm text-slate-500">GCI</div>
          <div className={`text-3xl font-bold ${scoreColor(gci)}`}>{gci.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-sm text-slate-500">DCI</div>
          <div className={`text-3xl font-bold ${scoreColor(dci)}`}>{dci.toFixed(0)}%</div>
        </div>
        <div className="flex-1 grid grid-cols-4 md:grid-cols-7 gap-2">
          {pillars.map((p) => (
            <div key={p.name} title={`${p.name}: ${p.value}%`}>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${scoreBg(p.value)} rounded-full`} style={{ width: `${Math.min(100, p.value)}%` }} />
              </div>
              <span className="text-xs text-slate-600">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
