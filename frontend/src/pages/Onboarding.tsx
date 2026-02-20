import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import client from '../api/client';

const ONBOARDING_KEY = 'mactech_onboarding_completed';

export function getOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  } catch {
    // ignore
  }
}

const STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'You’re using the MacTech Federal Governance & Risk Management Platform. This short setup will help you get started.' },
  { id: 'data', title: 'Regulatory data', description: 'Ensure FAR/DFARS clause data is loaded so you can run solicitations and clause reviews. If your admin has already run regulatory ingest, you’re all set.' },
  { id: 'solicitation', title: 'First solicitation', description: 'Create a solicitation to capture clauses, assess risk, and reach an approve-to-bid decision.' },
  { id: 'done', title: 'You’re set', description: 'Use Pre-Bid for solicitations, Clause Library, Auto-Builder, and Maturity. Admins can import more data via Admin.' }
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [regulatoryReady, setRegulatoryReady] = useState<boolean | null>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const checkRegulatory = () => {
    setRegulatoryReady(null);
    client.get('/compliance/library', { params: { limit: 1 } }).then(() => setRegulatoryReady(true)).catch(() => setRegulatoryReady(false));
  };

  const handleNext = () => {
    if (isLast) {
      setOnboardingCompleted();
      navigate('/');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleSkip = () => {
    setOnboardingCompleted();
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="bg-white rounded-xl shadow border border-slate-100 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display font-bold text-2xl text-gov-navy">Get started</h1>
          <span className="text-sm text-slate-500">Step {step + 1} of {STEPS.length}</span>
        </div>
        <h2 className="font-display font-semibold text-lg text-gov-navy mb-2">{current.title}</h2>
        <p className="text-slate-600 mb-6">{current.description}</p>

        {current.id === 'data' && (
          <div className="mb-6">
            {regulatoryReady === null && (
              <button type="button" onClick={checkRegulatory} className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
                Check regulatory data
              </button>
            )}
            {regulatoryReady === true && <p className="text-green-600 text-sm">Regulatory clause library is available.</p>}
            {regulatoryReady === false && (
              <p className="text-amber-700 text-sm">
                No clause library data yet. Ask an admin to run regulatory ingest via{' '}
                <Link to="/admin/regulatory-library" className="text-gov-blue underline">Admin → Regulatory Library</Link> or run <code className="bg-slate-100 px-1">reg:ingest</code>.
              </p>
            )}
          </div>
        )}

        {current.id === 'solicitation' && (
          <div className="mb-6">
            <Link to="/governance-engine/solicitations/engine/new" className="inline-block px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
              Create your first solicitation
            </Link>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={handleNext} className="px-4 py-2 bg-gov-blue text-white rounded-lg text-sm font-medium">
            {isLast ? 'Finish' : 'Next'}
          </button>
          {!isLast && (
            <button type="button" onClick={handleSkip} className="px-4 py-2 bg-slate-200 rounded-lg text-sm">
              Skip
            </button>
          )}
        </div>
      </div>
      {user && <p className="mt-4 text-center text-slate-500 text-sm">Logged in as {user.email}</p>}
    </div>
  );
}
