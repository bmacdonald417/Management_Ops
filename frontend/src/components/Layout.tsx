import { Outlet } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/contracts', label: 'Contracts' },
  { path: '/compliance', label: 'Compliance' },
  { path: '/financials', label: 'Financials' },
  { path: '/cyber', label: 'Cyber' }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gov-navy text-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <h1 className="font-display font-bold text-xl">MacTech Governance</h1>
              <nav className="flex gap-1">
                {navItems.map(({ path, label }) => {
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
