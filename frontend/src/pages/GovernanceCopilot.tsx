import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CopilotDrawer from '../components/governance/CopilotDrawer';

export default function GovernanceCopilot() {
  const { user } = useAuth();
  const [copilotOpen, setCopilotOpen] = useState(true);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">Governance Copilot</h1>
        <Link to="/governance-engine/auto-builder" className="text-gov-blue hover:underline">← Auto-Builder</Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <p className="text-slate-600 mb-4">
          AI-assisted governance workflows with RAG retrieval from the compliance knowledge base.
          Use the Copilot drawer to run modes: Clause Enrich, Extract Clauses, Score Assist, Executive Brief, or Section Help.
        </p>
        <button
          onClick={() => setCopilotOpen(true)}
          className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium"
        >
          Open Copilot
        </button>
      </div>

      <CopilotDrawer
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        context={{}}
        userRole={user?.role}
      />
    </div>
  );
}
