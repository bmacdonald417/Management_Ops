import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

interface Appendix {
  id: string;
  title: string;
  content: string;
  maturity: string;
}

export default function GovernanceAutoBuilderAppendices() {
  const [appendices, setAppendices] = useState<Appendix[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/governance/auto-builder/appendices').then((r) => {
      setAppendices(r.data.appendices ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading appendices...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Appendices</h1>
        <Link to="/governance-engine/auto-builder" className="px-4 py-2 bg-slate-200 rounded-lg text-sm">
          ← Back
        </Link>
      </div>

      <div className="space-y-6">
        {appendices.map((a) => (
          <div key={a.id} className="bg-white rounded-xl shadow p-6 border border-slate-100">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-display font-semibold text-lg text-gov-navy">
                Appendix {a.id} – {a.title}
              </h2>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                a.maturity === 'PLANNED' ? 'bg-slate-100 text-slate-600' :
                a.maturity === 'MANUAL' ? 'bg-amber-50 text-amber-700' :
                a.maturity === 'AUTOMATED' ? 'bg-green-50 text-green-700' :
                'bg-blue-50 text-blue-700'
              }`}>
                {a.maturity}
              </span>
            </div>
            <p className="text-slate-700 whitespace-pre-wrap">{a.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
