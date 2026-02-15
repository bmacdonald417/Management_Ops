import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';
import CopilotDrawer from '../components/governance/CopilotDrawer';
import RiskBadge from '../components/governance/RiskBadge';
import EscalationPill from '../components/governance/EscalationPill';
import Stepper from '../components/governance/Stepper';

interface Solicitation {
  id: string;
  solicitation_number: string;
  title: string;
  agency: string;
  contract_type: string;
  status: string;
  clause_entries: ClauseEntry[];
  approvals: Approval[];
  escalation_required?: boolean;
  executive_approval_required?: boolean;
  quality_approval_required?: boolean;
  financial_review_required?: boolean;
  cyber_review_required?: boolean;
  overall_risk_score?: number;
  overall_risk_level?: number;
  no_clauses_attestation?: boolean;
}

interface ClauseEntry {
  id: string;
  clause_number: string;
  clause_title?: string;
  category?: string;
  financial_dim: number;
  cyber_dim: number;
  liability_dim: number;
  regulatory_dim: number;
  performance_dim: number;
  total_score?: number;
  risk_level?: number;
  escalation_trigger?: boolean;
  notes?: string;
}

interface Approval {
  id: string;
  approval_type: string;
  status: string;
  approver_id?: string;
  approved_at?: string;
  comment?: string;
}

const STEPS = [
  { id: 'summary', label: 'Summary' },
  { id: 'clauses', label: 'Clause Entry' },
  { id: 'risk', label: 'Risk Summary' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'finalize', label: 'Finalize' }
];

const CATEGORIES = ['Termination', 'Changes', 'Audit/Records', 'Cyber/CUI', 'Insurance', 'Indemnification', 'Labor', 'Small Business', 'Other'];

function ApprovalRow({
  approval,
  solicitationId,
  onUpdate,
  submitting,
  setSubmitting
}: {
  approval: Approval;
  solicitationId: string;
  onUpdate: () => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
}) {
  const [comment, setComment] = useState('');
  const handleApprove = async (status: 'Approved' | 'Rejected') => {
    setSubmitting(true);
    try {
      await client.post(`/governance/solicitations/${solicitationId}/approve`, { approval_type: approval.approval_type, status, comment });
      onUpdate();
    } finally {
      setSubmitting(false);
    }
  };
  const isPending = approval.status === 'Pending';
  return (
    <div className="flex items-center justify-between py-2 border-b gap-4">
      <div className="flex-1">
        <span className="font-medium">{approval.approval_type}</span>
        {isPending && (
          <input
            type="text"
            placeholder="Comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="ml-2 text-sm border rounded px-2 py-1 w-48"
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-1 text-sm rounded ${approval.status === 'Approved' ? 'bg-green-100' : approval.status === 'Rejected' ? 'bg-red-100' : 'bg-slate-100'}`}>
          {approval.status}
        </span>
        {isPending && (
          <>
            <button onClick={() => handleApprove('Approved')} disabled={submitting} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Approve</button>
            <button onClick={() => handleApprove('Rejected')} disabled={submitting} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Reject</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function GovernanceSolicitationReview() {
  const { id } = useParams();
  const { user } = useAuth();
  const [sol, setSol] = useState<Solicitation | null>(null);
  const [step, setStep] = useState(0);
  const [bulkClauses, setBulkClauses] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const load = () => {
    client.get(`/governance/solicitations/${id}`).then((r) => {
      setSol(r.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleBulkAdd = async () => {
    const lines = bulkClauses.split(/[\n,;]/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setSubmitting(true);
    try {
      await client.post(`/governance/solicitations/${id}/clauses/bulk`, { clauses: lines });
      setBulkClauses('');
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setSubmitting(true);
    try {
      await client.post(`/governance/solicitations/${id}/submit`);
      load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    setSubmitting(true);
    try {
      await client.post(`/governance/solicitations/${id}/finalize`);
      load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Finalize failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClauseDimChange = async (clauseId: string, dim: keyof Pick<ClauseEntry, 'financial_dim' | 'cyber_dim' | 'liability_dim' | 'regulatory_dim' | 'performance_dim'>, val: number) => {
    const entry = sol?.clause_entries.find((c) => c.id === clauseId);
    if (!entry) return;
    await client.put(`/governance/solicitations/${id}/clauses/${clauseId}`, {
      financial_dim: dim === 'financial_dim' ? val : entry.financial_dim,
      cyber_dim: dim === 'cyber_dim' ? val : entry.cyber_dim,
      liability_dim: dim === 'liability_dim' ? val : entry.liability_dim,
      regulatory_dim: dim === 'regulatory_dim' ? val : entry.regulatory_dim,
      performance_dim: dim === 'performance_dim' ? val : entry.performance_dim
    });
    load();
  };

  if (loading || !sol) return <div className="text-slate-500">Loading...</div>;

  const canEdit = sol.status === 'DRAFT';
  const allApproved = sol.approvals.length > 0 && sol.approvals.every((a) => a.status === 'Approved');

  return (
    <div>
      <Link to="/governance-engine/solicitations" className="text-sm text-gov-blue hover:underline mb-4 inline-block">← Back to Solicitations</Link>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-gov-navy">{sol.solicitation_number}</h1>
          <p className="text-slate-500">{sol.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCopilotOpen(true)} className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
            AI Copilot
          </button>
          <RiskBadge level={sol.overall_risk_level ?? 1} />
          <span className={`px-2 py-1 text-xs font-medium rounded ${sol.status === 'FINALIZED' ? 'bg-green-100' : 'bg-slate-100'}`}>{sol.status}</span>
          {sol.status === 'FINALIZED' && <span className="text-sm text-slate-500">Locked</span>}
        </div>
      </div>

      <CopilotDrawer
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        context={{
          solicitationId: id!,
          clauseEntries: sol.clause_entries?.map((e) => ({ id: e.id, clause_number: e.clause_number })),
          rawText: bulkClauses
        }}
        userRole={user?.role}
        onApplyScoreAssist={() => { load(); setCopilotOpen(false); }}
      />

      <Stepper steps={STEPS} current={step} />
      <div className="flex gap-2 mt-4 mb-6">
        {STEPS.map((s, i) => (
          <button key={s.id} onClick={() => setStep(i)} className={`px-4 py-2 rounded-lg text-sm ${step === i ? 'bg-gov-blue text-white' : 'bg-slate-200'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Intake Summary</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div><dt className="text-slate-500">Agency</dt><dd>{sol.agency}</dd></div>
            <div><dt className="text-slate-500">Contract Type</dt><dd>{sol.contract_type}</dd></div>
            <div><dt className="text-slate-500">Clauses Entered</dt><dd>{sol.clause_entries?.length ?? 0}</dd></div>
            <div><dt className="text-slate-500">Overall Risk</dt><dd><RiskBadge level={sol.overall_risk_level ?? 1} /></dd></div>
          </dl>
          {canEdit && (sol.clause_entries?.length ?? 0) === 0 && (
            <label className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={sol.no_clauses_attestation ?? false}
                onChange={(e) =>
                  client.put(`/governance/solicitations/${id}`, { no_clauses_attestation: e.target.checked }).then(load)
                }
              />
              <span>Attest no clauses identified (Quality/Admin)</span>
            </label>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {canEdit && (
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-medium mb-2">Bulk Add Clauses</h3>
              <p className="text-sm text-slate-500 mb-2">Paste clause numbers (one per line or comma-separated)</p>
              <textarea
                value={bulkClauses}
                onChange={(e) => setBulkClauses(e.target.value)}
                placeholder="52.249-2&#10;252.204-7012"
                className="w-full h-24 px-4 py-2 border rounded-lg"
              />
              <button onClick={handleBulkAdd} disabled={submitting} className="mt-2 px-4 py-2 bg-gov-blue text-white rounded-lg text-sm">
                Add Clauses
              </button>
            </div>
          )}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <h3 className="p-4 font-medium">Clause Entries</h3>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Clause</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Category</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">F</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">C</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">L</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">R</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">P</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Score</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Level</th>
                </tr>
              </thead>
              <tbody>
                {(sol.clause_entries ?? []).map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-sm">{c.clause_number}</td>
                    <td className="px-4 py-2">
                      {canEdit ? (
                        <select value={c.category ?? ''} onChange={(e) => client.put(`/governance/solicitations/${id}/clauses/${c.id}`, { category: e.target.value }).then(load)} className="text-sm border rounded px-2 py-1">
                          {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      ) : (c.category ?? '—')}
                    </td>
                    {(['financial_dim', 'cyber_dim', 'liability_dim', 'regulatory_dim', 'performance_dim'] as const).map((dim) => (
                      <td key={dim} className="px-4 py-2">
                        {canEdit ? (
                          <select value={String((c[dim] ?? 2))} onChange={(e) => handleClauseDimChange(c.id, dim, parseInt(e.target.value, 10))} className="w-12 text-sm border rounded">
                            {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        ) : c[dim]}
                      </td>
                    ))}
                    <td className="px-4 py-2">{c.total_score?.toFixed(1) ?? '—'}</td>
                    <td className="px-4 py-2"><RiskBadge level={c.risk_level ?? 1} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!sol.clause_entries || sol.clause_entries.length === 0) && (
              <div className="p-8 text-center text-slate-500">No clauses. Add via bulk paste or attest no clauses in Summary.</div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-display font-semibold text-lg">Risk Summary</h2>
          <div className="grid grid-cols-4 gap-4">
            <div><div className="text-sm text-slate-500">Overall Score</div><div className="text-2xl font-bold">{sol.overall_risk_score?.toFixed(1) ?? '—'}</div></div>
            <div><div className="text-sm text-slate-500">Overall Level</div><div><RiskBadge level={sol.overall_risk_level ?? 1} /></div></div>
            <div><div className="text-sm text-slate-500">L3 Count</div><div className="text-2xl">{(sol.clause_entries ?? []).filter((c) => c.risk_level === 3).length}</div></div>
            <div><div className="text-sm text-slate-500">L4 Count</div><div className="text-2xl">{(sol.clause_entries ?? []).filter((c) => c.risk_level === 4).length}</div></div>
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-2">Escalation Flags</div>
            <div className="flex gap-2 flex-wrap">
              {sol.cyber_review_required && <EscalationPill type="Cyber" />}
              {sol.financial_review_required && <EscalationPill type="Financial" />}
              {sol.executive_approval_required && <EscalationPill type="Indemnification" />}
              {sol.quality_approval_required && <EscalationPill type="Audit" />}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Approvals</h2>
          <div className="space-y-3">
            {sol.approvals?.map((a) => (
              <ApprovalRow key={a.id} approval={a} solicitationId={id!} onUpdate={load} submitting={submitting} setSubmitting={setSubmitting} />
            ))}
            {(!sol.approvals || sol.approvals.length === 0) && sol.status === 'DRAFT' && (
              <p className="text-slate-500">Submit for approval to create approval records.</p>
            )}
          </div>
          {canEdit && (
            <button onClick={handleSubmitForApproval} disabled={submitting} className="mt-4 px-6 py-2 bg-gov-blue text-white rounded-lg">
              Submit for Approval
            </button>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Finalize</h2>
          {sol.status === 'FINALIZED' ? (
            <p className="text-green-600 font-medium">This solicitation is finalized and locked.</p>
          ) : sol.status === 'AWAITING_APPROVALS' && allApproved ? (
            <div>
              <p className="mb-4">All approvals complete. Finalizing will lock this record.</p>
              <button onClick={handleFinalize} disabled={submitting} className="px-6 py-2 bg-green-600 text-white rounded-lg">
                Finalize & Lock
              </button>
            </div>
          ) : (
            <p className="text-slate-500">Complete all required approvals before finalizing.</p>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-4">
        <Link to={`/governance-engine/solicitations/${id}/audit`} className="text-sm text-gov-blue hover:underline">View Audit Trail</Link>
        <Link to={`/governance-engine/solicitations/${id}/export`} className="text-sm text-gov-blue hover:underline">Export Packet (PDF)</Link>
      </div>
    </div>
  );
}
