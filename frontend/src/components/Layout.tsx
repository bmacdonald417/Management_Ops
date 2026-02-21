import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { governanceSidebarNav } from '../config/sidebarConfig';

const mainNavItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/contracts', label: 'Contracts' },
  { path: '/compliance', label: 'Compliance' },
  { path: '/financials', label: 'Financials' },
  { path: '/cyber', label: 'Cyber' },
  { path: '/cmmc-dashboard', label: 'CMMC Dashboard' }
];

const adminNavItems = [
  { path: '/admin/compliance-registry', label: 'Compliance Registry' },
  { path: '/admin/regulatory-library', label: 'Regulatory Library' },
  { path: '/admin/ai-settings', label: 'AI Settings' },
  { path: '/admin/cmmc-evidence', label: 'CMMC Evidence' }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [prebidOpen, setPrebidOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const isPrebidActive = location.pathname.startsWith('/governance-engine');
  const isAdminActive = location.pathname.startsWith('/admin');
  const showAdmin = user?.role && ['Level 1', 'Level 3'].includes(user.role);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gov-navy text-white shadow print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <h1 className="font-display font-bold text-xl">MacTech Governance</h1>
              <nav className="flex items-center gap-1">
                {mainNavItems.map(({ path, label }) => {
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
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setPrebidOpen(!prebidOpen); setAdminOpen(false); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      isPrebidActive ? 'bg-gov-blue text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    Pre-Bid
                  </button>
                  {prebidOpen && (
                    <div className="absolute top-full left-0 mt-1 py-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50 text-slate-800">
                      {governanceSidebarNav.flatMap((item) => {
                        if (item.children) {
                          return item.children.map((child) => (
                            <Link key={child.path} to={child.path} className="block px-4 py-2 text-sm hover:bg-slate-100" onClick={() => setPrebidOpen(false)}>
                              {child.label}
                            </Link>
                          ));
                        }
                        return [
                          <Link key={item.path} to={item.path} className="block px-4 py-2 text-sm hover:bg-slate-100" onClick={() => setPrebidOpen(false)}>
                            {item.label}
                          </Link>
                        ];
                      })}
                    </div>
                  )}
                </div>
                {showAdmin && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setAdminOpen(!adminOpen); setPrebidOpen(false); }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        isAdminActive ? 'bg-gov-blue text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      Admin
                    </button>
                    {adminOpen && (
                      <div className="absolute top-full left-0 mt-1 py-2 w-52 bg-white rounded-lg shadow-lg border border-slate-200 z-50 text-slate-800">
                        {adminNavItems.map(({ path, label }) => (
                          <Link key={path} to={path} className="block px-4 py-2 text-sm hover:bg-slate-100" onClick={() => setAdminOpen(false)}>
                            {label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
