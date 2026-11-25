import { LogOut } from 'lucide-react';
import { BRANDING } from '../../branding';

function DashboardShell({ title, role, onLogout, children }) {
  const roleLabel = role === 'admin' ? 'Placement Officer' : role === 'recruiter' ? 'Recruiter / Company' : 'Student';
  return <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white"><img src={BRANDING.logoPath} alt={`${BRANDING.shortUniversityName} university logo`} className="h-10 w-10 rounded-lg object-contain" /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-primary-600">{roleLabel}</p><h1 className="text-lg font-bold">{title}</h1></div></div>
        <button className="btn-secondary flex items-center gap-2" onClick={onLogout}><LogOut size={16} /> Sign out</button>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
  </div>;
}

export default DashboardShell;
