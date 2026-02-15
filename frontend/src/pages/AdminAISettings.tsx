import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

interface AIStatus {
  enabled: boolean;
  configured: boolean;
  model: string;
}

export default function AdminAISettings() {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    client.get('/ai/status')
      .then((r) => setStatus(r.data))
      .catch(() => setStatus({ enabled: false, configured: false, model: '' }))
      .finally(() => setLoading(false));
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const { data } = await client.post('/ai/chat', {
        messages: [{ role: 'user' as const, content: 'Say "AI is working" in exactly 3 words.' }],
        purpose: 'general'
      });
      setTestResult(data.reply ?? 'No response');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setTestError(err.response?.data?.error ?? 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading && !status) return <div className="text-slate-500">Loading...</div>;

  const ready = status?.enabled && status?.configured;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display font-bold text-2xl text-gov-navy">AI Settings</h1>
        <Link to="/admin/compliance-registry" className="text-gov-blue hover:underline">← Compliance Registry</Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-2xl">
        <h2 className="font-display font-semibold text-lg text-gov-navy mb-4">AI Status</h2>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3">
            {ready ? (
              <span className="text-green-600 text-lg">✓</span>
            ) : (
              <span className="text-amber-600 text-lg">✗</span>
            )}
            <span>
              {ready
                ? 'API key configured'
                : 'API key missing'}
            </span>
          </div>
          {!ready && (
            <p className="text-sm text-slate-600">
              Add OPENAI_API_KEY and AI_FEATURES_ENABLED=true in Railway → Variables, then redeploy.
            </p>
          )}
          {status?.model && (
            <p className="text-sm text-slate-500">Model: {status.model}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing || !ready}
            className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test AI'}
          </button>
          {testResult && (
            <span className="text-sm text-green-600">Response: {testResult}</span>
          )}
          {testError && (
            <span className="text-sm text-red-600">{testError}</span>
          )}
        </div>
      </div>
    </div>
  );
}
