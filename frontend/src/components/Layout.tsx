import { Outlet } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/contracts', label: 'Contracts' },
  { path: '/compliance', label: 'Compliance' },
  { path: '/governance-engine', label: 'Governance Engine' },
  { path: '/financials', label: 'Financials' },
  { path: '/cyber', label: 'Cyber' },
  { path: '/admin/compliance-registry', label: 'Compliance Registry', roles: ['Level 1', 'Level 3'] },
  { path: '/admin/regulatory-library', label: 'Regulatory Library', roles: ['Level 1', 'Level 3'] },
  { path: '/admin/ai-settings', label: 'AI Settings', roles: ['Level 1', 'Level 3'] }
];

const governanceSubNav = [
  { path: '/governance-engine', label: 'Pre-Bid Dashboard' },
  { path: '/governance-engine/solicitations', label: 'Solicitations' },
  { path: '/governance-engine/clause-library', label: 'Clause Library' },
  { path: '/governance-engine/auto-builder', label: 'Auto-Builder' },
  { path: '/governance-engine/copilot', label: 'Copilot' },
  { path: '/governance-engine/maturity', label: 'Maturity' },
  { path: '/governance-engine/reports', label: 'Reports' },
  { path: '/governance-engine/signature-requests', label: 'Signature Requests' },
  { path: '/governance-engine/proposals', label: 'Proposals' }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gov-navy text-white shadow print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <h1 className="font-display font-bold text-xl">MacTech Governance</h1>
              <nav className="flex gap-1">
                {navItems
                  .filter((item) => !item.roles || (user?.role && item.roles.includes(user.role)))
                  .map(({ path, label }) => {
                    const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
                    return (
                      <Link
                        key={path}
                        to={path}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          isActive ? 'bg-gov-blue text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-300">{user?.email}</span>
              <span className="text-xs bg-slate-700 px-2 py-1 rounded">{user?.role}</span>
              <button
                onClick={logout}
                className="text-sm text-slate-300 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      {location.pathname.startsWith('/governance-engine') && (
        <div className="bg-slate-100 border-b print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-1 py-2">
              {governanceSubNav.map(({ path, label }) => {
                const isActive = path === '/governance-engine' ? location.pathname === '/governance-engine' : location.pathname.startsWith(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${isActive ? 'bg-white text-gov-navy shadow' : 'text-slate-600 hover:text-gov-navy'}`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
