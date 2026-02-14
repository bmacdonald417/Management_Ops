import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';

interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  actor_email?: string;
  created_at: string;
}

export default function GovernanceAuditTrail() {
  const { id } = useParams();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get(`/governance/solicitations/${id}/audit`).then((r) => {
      setEvents(r.data);
      setLoading(false);
    });
  }, [id]);

  return (
    <div>
      <Link to={`/governance-engine/solicitations/${id}/review`} className="text-sm text-gov-blue hover:underline mb-4 inline-block">← Back to Review</Link>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">Audit Trail</h1>
      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <p className="text-sm text-slate-600">Chronological log of all changes for this solicitation.</p>
          </div>
          <ul className="divide-y divide-slate-200">
            {events.map((e) => (
              <li key={e.id} className="p-4 hover:bg-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">{e.action}</span>
                    {e.field_name && <span className="text-slate-500 ml-2">({e.field_name})</span>}
                  </div>
                  <div className="text-sm text-slate-500">
                    {new Date(e.created_at).toLocaleString()} • {e.actor_email ?? 'System'}
                  </div>
                </div>
                {e.old_value != null && e.new_value != null && (
                  <div className="mt-2 text-sm text-slate-600">
                    <span className="line-through text-red-600">{e.old_value}</span> → <span className="text-green-700">{e.new_value}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {events.length === 0 && <div className="p-12 text-center text-slate-500">No audit events yet.</div>}
        </div>
      )}
    </div>
  );
}
