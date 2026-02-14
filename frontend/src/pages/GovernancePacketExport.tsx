import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import RiskBadge from '../components/governance/RiskBadge';
import EscalationPill from '../components/governance/EscalationPill';

interface Solicitation {
  solicitation_number: string;
  title: string;
  agency: string;
  contract_type: string;
  est_value?: number;
  cui_involved?: boolean;
  cmmc_level?: string;
  status: string;
  overall_risk_score?: number;
  overall_risk_level?: number;
  escalation_required?: boolean;
  cyber_review_required?: boolean;
  financial_review_required?: boolean;
  owner_name?: string;
  clause_entries: { clause_number: string; clause_title?: string; category?: string; total_score?: number; risk_level?: number }[];
  approvals: { approval_type: string; status: string; approved_at?: string; comment?: string }[];
}

export default function GovernancePacketExport() {
  const { id } = useParams();
  const [sol, setSol] = useState<Solicitation | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    client.get(`/governance/solicitations/${id}`).then((r) => {
      setSol(r.data);
      setLoading(false);
    });
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !sol) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link to={`/governance-engine/solicitations/${id}/review`} className="text-sm text-gov-blue hover:underline">← Back to Review</Link>
        <button onClick={handlePrint} className="px-6 py-2 bg-gov-blue text-white rounded-lg font-medium hover:bg-gov-blue-light">
          Print / Save as PDF
        </button>
      </div>
      <div ref={printRef} className="bg-white rounded-xl shadow p-8 print:shadow-none print:p-0">
        <h1 className="text-2xl font-bold text-gov-navy mb-2">Pre-Bid Governance Packet</h1>
        <p className="text-slate-600 mb-8">{sol.solicitation_number} — {sol.title}</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4">Solicitation Summary</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-500">Agency</dt><dd>{sol.agency}</dd></div>
            <div><dt className="text-slate-500">Contract Type</dt><dd>{sol.contract_type}</dd></div>
            <div><dt className="text-slate-500">Est. Value</dt><dd>{sol.est_value != null ? `$${sol.est_value.toLocaleString()}` : '—'}</dd></div>
            <div><dt className="text-slate-500">CUI</dt><dd>{sol.cui_involved ? 'Yes' : 'No'}</dd></div>
            <div><dt className="text-slate-500">CMMC</dt><dd>{sol.cmmc_level ?? '—'}</dd></div>
            <div><dt className="text-slate-500">Owner</dt><dd>{sol.owner_name ?? '—'}</dd></div>
            <div><dt className="text-slate-500">Overall Risk</dt><dd><RiskBadge level={sol.overall_risk_level ?? 1} /></dd></div>
            <div><dt className="text-slate-500">Overall Score</dt><dd>{sol.overall_risk_score?.toFixed(1) ?? '—'}</dd></div>
          </dl>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4">Escalation Flags</h2>
          <div className="flex gap-2 flex-wrap">
            {sol.cyber_review_required && <EscalationPill type="Cyber" />}
            {sol.financial_review_required && <EscalationPill type="Financial" />}
            {sol.escalation_required && !sol.cyber_review_required && !sol.financial_review_required && <EscalationPill type="Indemnification" />}
            {!sol.cyber_review_required && !sol.financial_review_required && !sol.escalation_required && <span className="text-slate-500">None</span>}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4">Clause Entries</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Clause</th>
                <th className="text-left py-2">Title</th>
                <th className="text-left py-2">Category</th>
                <th className="text-left py-2">Score</th>
                <th className="text-left py-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {(sol.clause_entries ?? []).map((c, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 font-mono">{c.clause_number}</td>
                  <td className="py-2">{c.clause_title ?? '—'}</td>
                  <td className="py-2">{c.category ?? '—'}</td>
                  <td className="py-2">{c.total_score?.toFixed(1) ?? '—'}</td>
                  <td className="py-2"><RiskBadge level={c.risk_level ?? 1} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!sol.clause_entries || sol.clause_entries.length === 0) && <p className="text-slate-500 py-4">No clauses or attestation on file.</p>}
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4">Approvals</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Comment</th>
              </tr>
            </thead>
            <tbody>
              {(sol.approvals ?? []).map((a, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{a.approval_type}</td>
                  <td className="py-2">{a.status}</td>
                  <td className="py-2">{a.approved_at ? new Date(a.approved_at).toLocaleDateString() : '—'}</td>
                  <td className="py-2">{a.comment ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!sol.approvals || sol.approvals.length === 0) && <p className="text-slate-500 py-4">No approvals recorded.</p>}
        </section>

        <p className="text-xs text-slate-500 mt-8">Generated {new Date().toLocaleString()} — MacTech Governance Platform</p>
      </div>
    </div>
  );
}
