import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import MaturityBanner from '../components/governance/MaturityBanner';
import SectionCard from '../components/governance/SectionCard';

interface AutoBuilderData {
  context: {
    maturity: { overallScore: number; pillarContract: number; pillarFinancial: number; pillarCyber: number; pillarInsurance: number; pillarStructural: number; pillarAudit: number; pillarDocumentation: number; disconnectIndicators: string[] };
    registryStats?: { clauseMasterMeetsThreshold: boolean; cyberControlMeetsThreshold: boolean; costAccountExists: boolean };
  };
  dci: number;
  weakest: { id: string; title: string; eval: { level: string; score0to1: number; gaps: string[] }; improveLinks: { label: string; href: string; reason: string }[] }[];
  disconnectIndicators: string[];
}

export default function GovernanceAutoBuilder() {
  const [data, setData] = useState<AutoBuilderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/governance/auto-builder/context').then((r) => {
      setData(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading && !data) return <div className="text-slate-500">Loading...</div>;
  if (!data) return <div className="text-slate-500">Failed to load Auto-Builder data.</div>;

  const m = data.context.maturity;
  const pillars = [
    { name: 'Contract', value: m.pillarContract },
    { name: 'Financial', value: m.pillarFinancial },
    { name: 'Cyber', value: m.pillarCyber },
    { name: 'Insurance', value: m.pillarInsurance },
    { name: 'Structural', value: m.pillarStructural },
    { name: 'Audit', value: m.pillarAudit },
    { name: 'Documentation', value: m.pillarDocumentation }
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Auto-Builder</h1>
        <div className="flex gap-2">
          <Link to="/governance-engine/auto-builder/manual" className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
            Preview Manual
          </Link>
          <Link to="/governance-engine/auto-builder/evidence" className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
            Preview Evidence Packet
          </Link>
          <Link to="/governance-engine/auto-builder/appendices" className="px-4 py-2 bg-slate-200 rounded-lg text-sm">
            View Appendices
          </Link>
        </div>
      </div>

      <MaturityBanner gci={m.overallScore} dci={data.dci} pillars={pillars} />

      {data.context?.registryStats && (
        !data.context.registryStats.clauseMasterMeetsThreshold ||
        !data.context.registryStats.cyberControlMeetsThreshold ||
        !data.context.registryStats.costAccountExists
      ) ? (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <span className="text-amber-800">Some reference datasets are missing. Import via Compliance Registry to improve section maturity.</span>
          <Link to="/admin/compliance-registry" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium">
            Import Dataset
          </Link>
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Weakest Sections</h2>
          {data.weakest?.length === 0 ? (
            <p className="text-slate-500">No section data.</p>
          ) : (
            <div className="space-y-3">
              {data.weakest?.slice(0, 5).map((s) => (
                <SectionCard
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  level={s.eval.level}
                  score={Math.round(s.eval.score0to1 * 100)}
                  gaps={s.eval.gaps}
                  improveLinks={s.improveLinks}
                />
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">Automation Disconnects</h2>
          {data.disconnectIndicators?.length === 0 ? (
            <p className="text-green-600">No disconnects identified.</p>
          ) : (
            <ul className="space-y-2">
              {data.disconnectIndicators?.map((d, i) => (
                <li key={i} className="flex items-center gap-2 text-amber-700">
                  <span>⚠</span>
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 print:hidden">
        <Link to="/governance-engine" className="text-gov-blue hover:underline">← Back to Governance Engine</Link>
      </div>
    </div>
  );
}
