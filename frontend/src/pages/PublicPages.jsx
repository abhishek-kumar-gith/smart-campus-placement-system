import { useEffect, useState } from 'react';
import { ArrowRight, Briefcase, Building2, CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, LogIn, Menu, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { BRANDING } from '../branding';
import api from '../services/api';

function goPublic(path) {
  window.dispatchEvent(new CustomEvent('dcrust:navigate', { detail: path }));
}

const officerConfig = {
  name: 'Dr. Suresh Kumar Verma',
  title: 'Professor, Mechanical Engineering Department',
  department: 'Placement Cell Officer, DCRUST',
  email: 'skverma.me@dcrustm.org',
  phone: '',
};

function ReferenceHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [['#about', 'About'], ['#contact', 'Contact']];
  return <header className="sticky top-0 z-30 bg-navy-900 text-white shadow-lg">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-3 lg:px-8">
      <a href="/" className="flex min-w-0 items-center gap-3" onClick={(event) => { event.preventDefault(); goPublic('/'); }}>
        <img src={BRANDING.logoPath} alt={`${BRANDING.shortUniversityName} university logo`} className="h-11 w-11 rounded-full bg-white object-contain p-1" />
        <div className="hidden min-w-0 border-r border-white/40 pr-5 sm:block"><p className="max-w-[230px] text-xs font-semibold leading-4">Deenbandhu Chhotu Ram University of Science and Technology (DCRUST)</p><p className="text-[11px] text-blue-200">Murthal, Sonipat, Haryana</p></div>
        <div className="hidden items-center gap-2 pl-1 text-sm font-semibold md:flex"><Briefcase size={17} /> Placement Cell</div>
      </a>
      <nav className={`${menuOpen ? 'absolute left-0 right-0 top-full flex bg-navy-900 p-4 shadow-xl' : 'hidden'} flex-col gap-4 border-t border-white/10 lg:static lg:flex lg:flex-row lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}>
        <a href="/" className="font-medium text-blue-200 hover:text-white" onClick={(event) => { event.preventDefault(); goPublic('/'); setMenuOpen(false); }}>Home</a>
        {links.map(([href, label]) => <a key={`${href}-${label}`} href={href} className="font-medium text-blue-100 hover:text-white" onClick={() => setMenuOpen(false)}>{label}</a>)}
        <button type="button" className="rounded-lg border border-white/60 px-4 py-2 font-semibold hover:bg-white/10" onClick={() => goPublic('/register')}>Register</button>
        <button type="button" className="rounded-lg bg-white px-4 py-2 font-semibold text-navy-900 hover:bg-blue-50" onClick={() => goPublic('/login')}><LogIn className="mr-1 inline" size={15} /> Login</button>
      </nav>
      <button type="button" className="rounded-lg p-2 lg:hidden" aria-label="Toggle navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
    </div>
  </header>;
}

function ReferenceFooter() {
  return <footer id="contact" className="bg-navy-900 text-white"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.1fr_1.5fr_1fr_1fr] lg:px-8"><div className="flex items-start gap-3"><img src={BRANDING.logoPath} alt={`${BRANDING.shortUniversityName} logo`} className="h-12 w-12 rounded-full bg-white object-contain p-1" /><div><p className="font-bold">{BRANDING.shortUniversityName}</p><p className="text-xs text-blue-200">{BRANDING.location}</p></div></div><p className="text-sm leading-6 text-blue-100">{BRANDING.universityName}, Murthal, Sonipat - 131039, Haryana.</p><div className="text-sm text-blue-100"><a className="hover:text-white" href={`mailto:${BRANDING.officialEmail}`}>{BRANDING.officialEmail}</a><p className="mt-2"><a className="hover:text-white" href={`tel:${BRANDING.officialPhone}`}>{BRANDING.officialPhone}</a></p></div><a href="https://dcrustm.ac.in/" target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-100 hover:text-white">Official university website <ArrowRight className="ml-1 inline" size={14} /></a></div><div className="border-t border-white/10 px-4 py-4 text-center text-xs text-blue-200">© {new Date().getFullYear()} DCRUST Placement Cell. Public information is published only with university authorization.</div></footer>;
}

function PlacementStudentCard({ record }) {
  const initials = record.studentName?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"><div className="flex h-36 items-center justify-center bg-blue-50">{record.studentPhoto ? <img src={record.studentPhoto} alt={record.studentName} className="h-full w-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">{initials}</div>}</div><div className="p-4"><h3 className="font-bold text-navy-900">{record.studentName}</h3><p className="mt-1 text-sm text-slate-500">{record.branch} · {record.companyName}</p><p className="mt-3 text-xs font-semibold text-primary-700">Placement year {record.placementYear}</p></div></article>;
}

function formatDeadline(value) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ReferenceHero() {
  return <section className="bg-gradient-to-br from-blue-50 via-white to-blue-100"><div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-16"><div><p className="text-sm font-bold tracking-[0.12em] text-navy-900">DCRUST PLACEMENT CELL</p><h1 className="mt-4 text-4xl font-extrabold leading-tight text-navy-900 sm:text-5xl">Campus Placement Management <span className="text-primary-600">Portal</span></h1><div className="mt-4 h-1 w-16 bg-primary-600" /><p className="mt-5 max-w-xl text-sm leading-6 text-slate-700">A unified platform for students, recruiters and the Placement Cell to manage registration, job drives, resume screening and placement activities at DCRUST.</p><div className="mt-7 flex flex-wrap gap-3"><button className="btn-primary px-6 py-3" onClick={() => goPublic('/login')}><GraduationCap className="mr-2 inline" size={17} /> Student Login</button><button className="rounded-lg border border-primary-600 px-6 py-3 font-semibold text-navy-900 hover:bg-blue-100" onClick={() => goPublic('/login')}><Briefcase className="mr-2 inline" size={17} /> Recruiter Login</button></div></div><div className="relative overflow-hidden rounded-[2rem] border-8 border-white shadow-xl"><img src="/assets/dcrust-campus.png" alt="DCRUST campus" className="h-[300px] w-full object-cover sm:h-[380px]" /><div className="absolute inset-y-0 left-0 w-8 bg-primary-600/80 [clip-path:ellipse(55%_75%_at_0%_50%)]" /></div></div></section>;
}

function ReferencePublicPortal() {
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [dataError, setDataError] = useState(false);
  useEffect(() => {
    Promise.all([api.get('/placements/public/summary'), api.get('/placements/public?pageSize=3'), api.get('/jobs')])
      .then(([statsResponse, recordsResponse, jobsResponse]) => { setStats(statsResponse.data.data); setRecords(recordsResponse.data.data.records || []); setUpdates((jobsResponse.data.data || []).slice(0, 4)); })
      .catch(() => setDataError(true));
  }, []);
  const statItems = [[GraduationCap, stats?.students, 'Total Students'], [Building2, stats?.departments, 'Departments'], [Users, stats?.recruiters, 'Recruiters'], [ShieldCheck, stats?.placed, 'Students Placed'], [CheckCircle2, stats ? `${stats.placementPercentage}%` : null, 'Placement Record']];
  const featureItems = [['Student Registration', GraduationCap, 'Register and maintain a verified placement profile.', '/register', 'bg-indigo-50'], ['Job / Drive Listings', Briefcase, 'Discover approved opportunities and campus drives.', '/login', 'bg-emerald-50'], ['ATS Resume Parsing', Search, 'Use existing resume parsing and scoring workflows.', '/login', 'bg-orange-50'], ['Skill Extraction', Sparkles, 'Understand skills and identify practical gaps.', '/login', 'bg-sky-50'], ['Job Recommendation', ArrowRight, 'Find opportunities matched to your profile.', '/login', 'bg-violet-50'], ['Placement Prediction', CheckCircle2, 'Track readiness and placement outcomes.', '/login', 'bg-green-50']];
  return <div className="min-h-screen bg-slate-50 text-slate-900"><ReferenceHeader /><ReferenceHero /><section className="relative z-10 mx-auto -mt-7 max-w-6xl px-4"><div className="grid gap-4 rounded-xl bg-white p-5 shadow-card sm:grid-cols-2 lg:grid-cols-5">{statItems.map(([Icon, value, label]) => <div key={label} className="flex items-center gap-3 border-slate-200 px-2 lg:border-r last:border-0"><Icon className="text-primary-600" size={28} /><div><p className="text-2xl font-bold text-navy-900">{dataError ? 'N/A' : value ?? '—'}</p><p className="text-xs font-medium text-slate-600">{label}</p></div></div>)}</div></section>
    <section id="about" className="mx-auto grid max-w-7xl gap-5 px-4 py-16 lg:grid-cols-3 lg:px-8"><article className="card"><div className="flex items-center gap-2 text-navy-900"><Building2 className="text-primary-600" /><h2 className="font-bold">About DCRUST</h2></div><div className="mt-4 flex gap-4"><img src={BRANDING.campusImagePath} alt="DCRUST building" className="h-24 w-28 rounded-lg object-cover" /><p className="text-xs leading-5 text-slate-600">Deenbandhu Chhotu Ram University of Science and Technology is dedicated to quality technical education, research and innovation.</p></div><a href="https://dcrustm.ac.in/" target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-primary-700">Read More <ArrowRight className="ml-1" size={14} /></a></article><article id="placement-cell" className="card bg-blue-50"><div className="flex items-center gap-2 text-navy-900"><Users className="text-primary-600" /><h2 className="font-bold">Placement Cell</h2></div><p className="mt-5 text-sm leading-6 text-slate-700">The Placement Cell acts as a bridge between students and industry, facilitating internships, placements, and industry interactions for better career opportunities.</p><a href="#features" className="mt-5 inline-flex rounded-full bg-blue-100 px-4 py-2 text-xs font-semibold text-primary-700">Know More <ArrowRight className="ml-1" size={14} /></a></article><article className="card"><div className="flex items-center gap-2 text-navy-900"><Briefcase className="text-primary-600" /><h2 className="font-bold">Placement Cell Officer</h2></div><div className="mt-4 flex gap-4"><img src={BRANDING.placementOfficerImagePath} alt={officerConfig.name} className="h-28 w-24 shrink-0 rounded-lg object-cover object-top" /><div className="text-xs leading-5 text-slate-600"><p className="font-bold text-navy-900">{officerConfig.name}</p><p>{officerConfig.title}</p><p>{officerConfig.department}</p><p className="mt-2"><a className="font-medium text-primary-700 hover:underline" href={`mailto:${officerConfig.email}`}>{officerConfig.email}</a></p></div></div></article></section>
    <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-16 lg:grid-cols-[1.7fr_1fr] lg:px-8"><div id="features" className="card"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold text-navy-900"><Sparkles className="text-primary-600" /> Key Features</h2></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{featureItems.map(([title, Icon, description, path, tone]) => <button key={title} type="button" className={`rounded-xl p-4 text-center transition hover:-translate-y-1 hover:shadow-card-hover ${tone}`} onClick={() => goPublic(path)}><Icon className="mx-auto text-primary-600" size={25} /><p className="mt-3 text-xs font-semibold text-navy-900">{title}</p><p className="mt-2 hidden text-[11px] leading-4 text-slate-600 sm:block">{description}</p></button>)}</div></div><div id="updates" className="card"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold text-navy-900"><CheckCircle2 className="text-primary-600" /> Latest Updates</h2><button type="button" className="text-xs font-semibold text-primary-700 hover:underline" onClick={() => goPublic('/placement-drives')}>View All <ArrowRight className="ml-1 inline" size={12} /></button></div>{updates.length ? <div className="mt-4 divide-y divide-slate-100">{updates.map((job) => <button key={job._id} type="button" className="flex w-full items-start gap-3 py-3 text-left" onClick={() => goPublic(`/placement-drives?job=${job._id}`)}><Briefcase className="mt-0.5 shrink-0 text-primary-600" size={17} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-navy-900">{job.companyId?.name || 'Verified company'} · {job.title}</p><p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{job.description}</p></div><time className="shrink-0 text-[10px] text-slate-500">{formatDeadline(job.applicationDeadline)}</time></button>)}</div> : <div className="mt-5 rounded-lg bg-slate-50 p-5 text-center text-xs leading-5 text-slate-500">No active placement updates at the moment. Please check back later.</div>}</div></section>
    <section className="bg-white"><div className="mx-auto max-w-7xl px-4 py-16 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">Verified outcomes</p><h2 className="mt-2 text-3xl font-bold text-navy-900">Our Placed Students</h2></div><button className="btn-primary" onClick={() => goPublic('/placement-records')}>View All Placed Students <ArrowRight className="ml-2 inline" size={16} /></button></div>{records.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{records.map((record) => <PlacementStudentCard key={record._id} record={record} />)}</div> : <p className="mt-8 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No approved placement records are available for public showcase yet.</p>}</div></section><ReferenceFooter /></div>;
}

function ReferencePlacementDrives() {
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState('');
  const [company, setCompany] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api.get('/jobs').then(({ data }) => {
      if (active) setJobs(data.data || []);
    }).catch(() => {
      if (active) setError('Placement drives are temporarily unavailable. Please try again later.');
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, []);
  const companies = [...new Set(jobs.map((job) => job.companyId?.name).filter(Boolean))].sort();
  const filtered = jobs.filter((job) => {
    const text = `${job.title || ''} ${job.companyId?.name || ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (!company || job.companyId?.name === company);
  });
  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const updateFilter = (setter) => (event) => { setter(event.target.value); setPage(1); };
  return <div className="min-h-screen bg-slate-50"><ReferenceHeader /><main className="mx-auto max-w-7xl px-4 py-12 lg:px-8"><button type="button" className="mb-6 inline-flex items-center text-sm font-semibold text-primary-700" onClick={() => goPublic('/')}><ChevronLeft size={16} /> Back to portal</button><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">DCRUST Placement Cell</p><h1 className="mt-2 text-4xl font-bold text-navy-900">Active Placement Drives</h1><p className="mt-3 text-slate-600">Approved and active opportunities currently open for registration.</p></div><div className="rounded-xl bg-white px-6 py-4 text-center shadow-card"><p className="text-3xl font-bold text-navy-900">{filtered.length}</p><p className="text-xs text-slate-500">Active drives</p></div></div><div className="mt-8 grid gap-3 rounded-xl bg-white p-4 shadow-card md:grid-cols-2"><label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="input pl-9" placeholder="Search company or job title" value={query} onChange={updateFilter(setQuery)} /></label><select className="input" value={company} onChange={updateFilter(setCompany)}><option value="">All companies</option>{companies.map((name) => <option key={name}>{name}</option>)}</select></div>{error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}{busy ? <div className="py-20 text-center text-sm text-slate-500">Loading active placement drives...</div> : visible.length ? <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{visible.map((job) => <article key={job._id} className="rounded-xl bg-white p-5 shadow-card"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50"><Briefcase className="text-primary-600" size={20} /></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span></div><p className="mt-4 text-xs font-semibold text-primary-700">{job.companyId?.name || 'Verified company'}</p><h2 className="mt-1 font-bold text-navy-900">{job.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{job.description}</p><div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">Registration deadline</p><p className="mt-1 text-sm font-semibold text-navy-900">{formatDeadline(job.applicationDeadline)}</p></div></article>)}</div> : <div className="mt-8 rounded-xl bg-white p-12 text-center shadow-card"><Briefcase className="mx-auto text-slate-300" size={40} /><h2 className="mt-4 font-semibold text-navy-900">No active placement updates at the moment.</h2><p className="mt-2 text-sm text-slate-500">Please check back later.</p></div>}{totalPages > 1 && <div className="mt-8 flex items-center justify-center gap-4"><button className="btn-secondary p-2" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button><span className="text-sm text-slate-600">Page {page} of {totalPages}</span><button className="btn-secondary p-2" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} aria-label="Next page"><ChevronRight size={18} /></button></div>}</main><ReferenceFooter /></div>;
}

function ReferencePublicRecords() {
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({ branches: [], companies: [], years: [] });
  const [query, setQuery] = useState({ search: '', branch: '', company: '', placementYear: '', page: 1 });
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setBusy(true);
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value));
    api.get(`/placements/public?${params.toString()}`).then(({ data }) => {
      if (!active) return;
      setRecords(data.data.records || []);
      setFilters(data.data.filters || { branches: [], companies: [], years: [] });
      setMeta({ total: data.data.total || 0, totalPages: data.data.totalPages || 0 });
      setError('');
    }).catch(() => { if (active) setError('Placement records are temporarily unavailable. Please try again later.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [query]);
  const updateQuery = (key, value) => setQuery((current) => ({ ...current, [key]: value, page: 1 }));
  return <div className="min-h-screen bg-slate-50"><ReferenceHeader /><main className="mx-auto max-w-7xl px-4 py-12 lg:px-8"><button type="button" className="mb-6 inline-flex items-center text-sm font-semibold text-primary-700" onClick={() => goPublic('/')}><ChevronLeft size={16} /> Back to portal</button><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">DCRUST Placement Cell</p><h1 className="mt-2 text-4xl font-bold text-navy-900">Our Placed Students</h1><p className="mt-3 text-slate-600">Approved public placement records from the available placement history.</p></div><div className="rounded-xl bg-white px-6 py-4 text-center shadow-card"><p className="text-3xl font-bold text-navy-900">{meta.total}</p><p className="text-xs text-slate-500">Total placed students</p></div></div><div className="mt-8 grid gap-3 rounded-xl bg-white p-4 shadow-card md:grid-cols-2 lg:grid-cols-4"><label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="input pl-9" placeholder="Search name or roll number" value={query.search} onChange={(event) => updateQuery('search', event.target.value)} /></label><select className="input" value={query.branch} onChange={(event) => updateQuery('branch', event.target.value)}><option value="">All branches</option>{filters.branches.map((value) => <option key={value}>{value}</option>)}</select><select className="input" value={query.company} onChange={(event) => updateQuery('company', event.target.value)}><option value="">All companies</option>{filters.companies.map((value) => <option key={value}>{value}</option>)}</select><select className="input" value={query.placementYear} onChange={(event) => updateQuery('placementYear', event.target.value)}><option value="">All years</option>{filters.years.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>{error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}{busy ? <div className="py-20 text-center text-sm text-slate-500">Loading approved placement records...</div> : records.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{records.map((record) => <article key={record._id} className="overflow-hidden rounded-xl bg-white shadow-card"><div className="flex h-40 items-center justify-center bg-blue-50">{record.studentPhoto ? <img src={record.studentPhoto} alt={record.studentName} className="h-full w-full object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700">{record.studentName?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>}</div><div className="p-5"><h2 className="font-semibold text-navy-900">{record.studentName}</h2><p className="mt-1 text-sm text-slate-500">Roll no. {record.rollNumber}</p><p className="mt-1 text-sm text-slate-500">{record.branch} · {record.department || 'University programme'}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm"><span className="font-medium text-slate-700">{record.companyName}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary-700">{record.placementYear}</span></div></div></article>)}</div> : <div className="mt-8 rounded-xl bg-white p-12 text-center shadow-card"><Users className="mx-auto text-slate-300" size={40} /><h2 className="mt-4 font-semibold text-navy-900">No placement records found</h2><p className="mt-2 text-sm text-slate-500">Try clearing a filter or search term.</p></div>}{meta.totalPages > 1 && <div className="mt-8 flex items-center justify-center gap-4"><button className="btn-secondary p-2" disabled={query.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))} aria-label="Previous page"><ChevronLeft size={18} /></button><span className="text-sm text-slate-600">Page {query.page} of {meta.totalPages}</span><button className="btn-secondary p-2" disabled={query.page >= meta.totalPages} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))} aria-label="Next page"><ChevronRight size={18} /></button></div>}</main><ReferenceFooter /></div>;
}

export { ReferencePublicPortal, ReferencePlacementDrives, ReferencePublicRecords };
