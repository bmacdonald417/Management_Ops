import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import ReactMarkdown from 'react-markdown';

export default function GovernanceAutoBuilderManual() {
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/governance/auto-builder/manual').then((r) => {
      setMarkdown(r.data.markdown ?? '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handlePrint = () => window.print();

  if (loading) return <div className="text-slate-500">Loading manual...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Manual Preview</h1>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
            Export Manual
          </button>
          <Link to="/governance-engine/auto-builder" className="px-4 py-2 bg-slate-200 rounded-lg text-sm">
            ← Back
          </Link>
        </div>
      </div>

      <article className="prose prose-slate max-w-none bg-white p-8 rounded-xl shadow print:p-0 print:shadow-none">
        <ReactMarkdown>{markdown || '*No content generated.*'}</ReactMarkdown>
      </article>
    </div>
  );
}
