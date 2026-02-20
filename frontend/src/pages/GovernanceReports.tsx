import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

export default function GovernanceReports() {
  const [data, setData] = useState<{ status: string; overall_risk_level: number; count: string }[]>([]);

  useEffect(() => {
    client.get('/governance/reports').then((r) => setData(r.data));
  }, []);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-gov-navy mb-6">Governance Reports</h1>
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-display font-semibold text-lg mb-4">Status & Risk Distribution</h2>
        <table className="min-w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Risk Level</th>
              <th className="text-left py-2">Count</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">{r.status}</td>
                <td className="py-2">L{r.overall_risk_level ?? 1}</td>
                <td className="py-2">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
        <div className="py-12 text-center text-slate-600">
          <p className="font-medium text-gov-navy mb-1">No report data yet</p>
          <p className="text-sm mb-4">Create and complete solicitations to see status and risk reports.</p>
          <Link to="/governance-engine/solicitations/engine/new" className="text-gov-blue hover:underline text-sm">Create a solicitation</Link>
        </div>
      )}
      </div>
    </div>
  );
}
