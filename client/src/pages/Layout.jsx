import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCircle,
  Users,
  FileText,
  Rocket,
  Globe,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: UserCircle },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/campaigns', label: 'Campaigns', icon: Rocket },
  { to: '/scraper', label: 'Scraper', icon: Globe },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 bg-[#0d0d0d] border-r border-[#1e1e1e] flex flex-col">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-[#1e1e1e]">
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="text-amber-500">Mail</span>
            <span className="text-white">Flow</span>
          </h1>
          <p className="text-xs text-muted mt-1 tracking-wide">Cold Email Automation</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-500 border-l-2 border-amber-500'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1e1e1e]">
          <p className="text-[11px] text-gray-600">MailFlow v1.0</p>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[#0a0a0a] p-8">
        <div className="max-w-7xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
