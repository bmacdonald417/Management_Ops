import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('admin@mactech.local');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDevLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post('/api/auth/dev-token');
      login(data.token, data.user);
      navigate('/');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gov-navy flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-2xl text-gov-navy">MacTech Governance</h1>
          <p className="text-slate-500 mt-2">Federal Contract Governance & Risk Management Platform</p>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-blue focus:border-transparent"
            />
          </div>
          <button
            onClick={handleDevLogin}
            disabled={loading}
            className="w-full py-3 bg-gov-blue text-white font-medium rounded-lg hover:bg-gov-blue-light transition disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in (Dev)'}
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-500 text-center">
          Dev mode: uses dev-token endpoint. Run db:seed to create admin user.
        </p>
      </div>
    </div>
  );
}
