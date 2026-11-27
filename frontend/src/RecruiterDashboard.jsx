import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, ExternalLink } from 'lucide-react';
import OfferCenter from './components/OfferCenter';
import api from './services/api';
import { transferProtectedPdf } from './services/protectedPdf';
import StatusBadge from './components/common/StatusBadge';
import StatCard from './components/common/StatCard';

const statusLabels = ['applied', 'shortlisted', 'interview', 'selected', 'rejected'];
const nextStatuses = {
  applied: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['selected', 'rejected'],
  selected: ['rejected'],
};

const Badge = ({ value }) => <StatusBadge status={value} />;
const Card = StatCard;

function RecruiterDashboard({ session, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState({ records: [], pagination: {} });
  const [interviews, setInterviews] = useState([]);
  const [directory, setDirectory] = useState({ records: [], pagination: {} });
  const [filters, setFilters] = useState({ search: '', jobId: '', status: '', branch: '', minCgpa: '', maxCgpa: '', page: 1 });
  const [directoryFilters, setDirectoryFilters] = useState({ search: '', branch: '', minCgpa: '', maxCgpa: '', graduationYear: '', skills: '', jobId: '', page: 1 });
  const [companyForm, setCompanyForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resumeBusy, setResumeBusy] = useState({});
  const [showDriveForm, setShowDriveForm] = useState(false);
  const [editingDrive, setEditingDrive] = useState(null);

  const loadBase = async () => {
    setLoading(true);
    try {
      const [profileData, dashboardData, jobsData, companyData, interviewsData] = await Promise.all([
        api.get('/recruiters/profile'), api.get('/recruiters/dashboard'), api.get('/jobs?all=true'),
        api.get('/recruiters/company'), api.get('/interviews?page=1&pageSize=100'),
      ]);
      setProfile(profileData.data.data);
      setDashboard(dashboardData.data.data);
      setJobs(jobsData.data.data || []);
      setCompany(companyData.data.data);
      setCompanyForm(companyData.data.data || {});
      setInterviews(interviewsData.data.data?.records || interviewsData.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load recruiter dashboard.');
    } finally { setLoading(false); }
  };

  const loadApplications = async (next = filters) => {
    const params = new URLSearchParams(Object.entries(next).filter(([, value]) => value !== ''));
    const response = await api.get(`/recruiters/applications?${params}`);
    setApplications({ records: response.data.data || [], pagination: response.data.pagination || {} });
  };

  const loadDirectory = async (next = directoryFilters) => {
    const params = new URLSearchParams(Object.entries(next).filter(([, value]) => value !== ''));
    const response = await api.get(`/recruiters/students?${params}`);
    setDirectory({ records: response.data.data || [], pagination: response.data.pagination || {} });
  };

  useEffect(() => { loadBase(); }, [session.user.id]);
  useEffect(() => { if (tab === 'applications') loadApplications(); }, [tab, filters]);
  useEffect(() => { if (tab === 'directory') loadDirectory(); }, [tab, directoryFilters]);

  const updateApplication = async (application, status) => {
    setBusy(true);
    try {
      await api.patch(`/applications/${application._id}/status`, { status });
      toast.success(`Application marked ${status}.`);
      await Promise.all([loadApplications(), loadBase()]);
    } catch (error) { toast.error(error.response?.data?.message || 'Application status update failed.'); }
    finally { setBusy(false); }
  };

  const openResume = async (application, download = false) => {
    if (!application.resume?.available) {
      toast.error('Resume not available for this application.');
      return;
    }
    const busyKey = `${application._id}:${download ? 'download' : 'view'}`;
    setResumeBusy((current) => ({ ...current, [busyKey]: true }));
    try {
      await transferProtectedPdf({
        api,
        endpoint: `/applications/${application._id}/resume${download ? '?download=true' : ''}`,
        fileName: application.resume.fileName || 'resume.pdf',
        download,
        onError: toast.error,
        blockedMessage: 'The browser blocked the resume viewer. Allow pop-ups and try again.',
        failureMessage: 'Resume could not be opened.',
      });
    } finally {
      setResumeBusy((current) => ({ ...current, [busyKey]: false }));
    }
  };

  const saveCompany = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const allowed = ['website', 'description', 'location', 'hrName', 'hrEmail', 'contactNumber'];
      const payload = Object.fromEntries(allowed.map((key) => [key, companyForm[key] || '']));
      const response = await api.patch('/recruiters/company', payload);
      setCompany(response.data.data); toast.success('Company profile updated.');
    } catch (error) { toast.error(error.response?.data?.message || 'Company profile update failed.'); }
    finally { setBusy(false); }
  };

  const startEditingDrive = (job) => {
    setEditingDrive(job);
    setShowDriveForm(true);
  };
  const createDrive = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    if (profile?.approvalStatus !== 'approved') {
      toast.error('Your recruiter account must be approved before posting a drive.');
      return;
    }

    const allowedBranches = form.getAll('allowedBranches');
    if (!allowedBranches.length) {
      toast.error('Please select at least one eligible branch.');
      return;
    }

    const packageMin = Number(form.get('packageMin') || 0);
    const packageMax = Number(form.get('packageMax') || 0);

    if (packageMax > 0 && packageMax < packageMin) {
      toast.error('Maximum package cannot be less than minimum package.');
      return;
    }

    const publishDate = new Date(`${form.get('publishDate')}T00:00:00`);
    const applicationDeadline = new Date(`${form.get('applicationDeadline')}T23:59:59`);

    if (Number.isNaN(publishDate.getTime()) || Number.isNaN(applicationDeadline.getTime())) {
      toast.error('Please enter valid publish and application dates.');
      return;
    }

    if (applicationDeadline < publishDate) {
      toast.error('Application deadline cannot be before the publish date.');
      return;
    }

    const targetSemester = form.get('targetSemester');
    const allowedSemesters = form.getAll('allowedSemesters').map(Number);

    const payload = {
      title: form.get('title')?.trim(),
      description: form.get('description')?.trim(),
      location: form.get('location')?.trim(),
      jobType: form.get('jobType'),
      requiredExperience: form.get('requiredExperience')?.trim() || '',
      package: {
        min: packageMin,
        max: packageMax,
        currency: 'INR',
      },
      requiredSkills: (form.get('requiredSkills') || '')
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
      minCgpa: Number(form.get('minCgpa')),
      allowedBranches,
      targetGraduationYear: Number(form.get('targetGraduationYear')),
      maxBacklogs: Number(form.get('maxBacklogs')),
      vacancies: Number(form.get('vacancies')),
      publishDate: publishDate.toISOString(),
      applicationDeadline: applicationDeadline.toISOString(),
    };

    if (targetSemester) payload.targetSemester = Number(targetSemester);
    if (allowedSemesters.length) payload.allowedSemesters = allowedSemesters;

    setBusy(true);
    try {
      if (editingDrive) {
        await api.patch(`/jobs/${editingDrive._id}`, payload);
      } else {
        await api.post('/jobs', payload);
      }
      toast.success(editingDrive ? 'Placement drive updated successfully.' : 'Placement drive submitted for approval.');
      formElement.reset();
      setShowDriveForm(false);
      setEditingDrive(null);
      await loadBase();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Placement drive could not be created.');
    } finally {
      setBusy(false);
    }
  };
  const scheduleInterview = async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api.post('/interviews', {
        applicationId: form.get('applicationId'), round: form.get('round'), mode: form.get('mode'),
        scheduledAt: new Date(form.get('scheduledAt')).toISOString(), venue: form.get('venue'), meetingLink: form.get('meetingLink'), instructions: form.get('instructions'),
      });
      toast.success('Interview scheduled.'); event.currentTarget.reset(); await Promise.all([loadBase(), loadApplications()]);
    } catch (error) { toast.error(error.response?.data?.message || 'Interview could not be scheduled.'); }
    finally { setBusy(false); }
  };

  const applicationRows = useMemo(() => applications.records, [applications.records]);
  if (loading) return <div className="card">Loading recruiter dashboard...</div>;

  return <div className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4"><div><p className="text-xs font-semibold uppercase text-primary-600">Recruiter / Company</p><h1 className="text-xl font-bold">Recruiter Dashboard</h1></div><button className="btn-secondary" onClick={onLogout}>Sign out</button></div></header>
    <main className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap gap-2">{[['overview', 'Overview'], ['company', 'My Company'], ['drives', 'My Drives'], ['applications', 'Applications'], ['directory', 'Student Directory'], ['interviews', 'Interviews'], ['offers', 'Offer Letters'], ['analytics', 'Analytics']].map(([id, label]) => <button key={id} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === id ? 'bg-primary-600 text-white' : 'border bg-white'}`} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {tab === 'overview' && <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card label="Active drives" value={dashboard?.activeDrives} /><Card label="Applications" value={dashboard?.totalApplications} /><Card label="Pending applications" value={dashboard?.pendingApplications} /><Card label="Upcoming interviews" value={dashboard?.upcomingInterviews} /><Card label="Shortlisted" value={dashboard?.shortlisted} /><Card label="Rejected" value={dashboard?.rejected} /><Card label="Selected" value={dashboard?.selected} /></div><div className="card mt-6"><h2 className="font-bold">Company access</h2><p className="mt-2 text-sm text-gray-600">{company?.name} · {profile?.designation} · approval <Badge value={profile?.approvalStatus} /></p></div></>}
      {tab === 'company' && <form className="card max-w-3xl space-y-4" onSubmit={saveCompany}><h2 className="text-xl font-bold">{company?.name}</h2><p className="text-sm text-gray-500">Approval status: <Badge value={company?.status} /> (managed by Placement Officer)</p>{['website', 'location', 'hrName', 'hrEmail', 'contactNumber'].map((key) => <input key={key} className="input" name={key} value={companyForm[key] || ''} placeholder={key} onChange={(event) => setCompanyForm({ ...companyForm, [key]: event.target.value })} />)}<textarea className="input min-h-32" name="description" value={companyForm.description || ''} placeholder="Company description" onChange={(event) => setCompanyForm({ ...companyForm, description: event.target.value })} /><button className="btn-primary" disabled={busy}>Save permitted fields</button></form>}
      {tab === 'drives' && <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">My Drives</h2>
          {profile?.approvalStatus === 'approved'
            ? <button type="button" className="btn-primary" onClick={() => { setEditingDrive(null); setShowDriveForm((value) => !value); }}>{showDriveForm ? 'Close Form' : '+ Post Drive'}</button>
            : <span className="text-sm text-amber-700">Drive posting unlocks after recruiter approval.</span>}
        </div>
        {showDriveForm && profile?.approvalStatus === 'approved' && <form key={editingDrive?._id || 'new-drive'} className="mb-6 space-y-4 rounded-xl border p-4" onSubmit={createDrive}>
          <div><h3 className="text-lg font-semibold">{editingDrive ? 'Edit Placement Drive' : 'Post a Placement Drive'}</h3><p className="text-sm text-gray-500">Your drive will be submitted for Placement Officer approval.</p></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Job title<input className="input" name="title" defaultValue={editingDrive?.title || ''} minLength="2" required /></label>
            <label className="space-y-1 text-sm font-medium">Location<input className="input" name="location" defaultValue={editingDrive?.location || ''} minLength="2" required /></label>
            <label className="space-y-1 text-sm font-medium">Job type<select className="input" name="jobType" defaultValue={editingDrive?.jobType || 'Full-time'}><option>Full-time</option><option>Internship</option><option>Contract</option></select></label>
            <label className="space-y-1 text-sm font-medium">Required experience<input className="input" name="requiredExperience" defaultValue={editingDrive?.requiredExperience || ''} placeholder="Fresher / 0-1 years" /></label>
            <label className="space-y-1 text-sm font-medium">Minimum package (INR/year)<input className="input" name="packageMin" defaultValue={editingDrive?.package?.min ?? 0} type="number" min="0" step="0.01" defaultValue="0" /></label>
            <label className="space-y-1 text-sm font-medium">Maximum package (INR/year)<input className="input" name="packageMax" defaultValue={editingDrive?.package?.max ?? 0} type="number" min="0" step="0.01" defaultValue="0" /></label>
            <label className="space-y-1 text-sm font-medium">Minimum CGPA<input className="input" name="minCgpa" defaultValue={editingDrive?.minCgpa ?? 0} type="number" min="0" max="10" step="0.01" defaultValue="0" required /></label>
            <label className="space-y-1 text-sm font-medium">Target graduation year<input className="input" name="targetGraduationYear" defaultValue={editingDrive?.targetGraduationYear ?? ''} type="number" min="2020" max="2100" required placeholder="2027" /></label>
            <label className="space-y-1 text-sm font-medium">Maximum backlogs<input className="input" name="maxBacklogs" defaultValue={editingDrive?.maxBacklogs ?? 0} type="number" min="0" defaultValue="0" required /></label>
            <label className="space-y-1 text-sm font-medium">Vacancies<input className="input" name="vacancies" defaultValue={editingDrive?.vacancies ?? ''} type="number" min="1" required /></label>
            <label className="space-y-1 text-sm font-medium">Target semester (optional)<select className="input" name="targetSemester" defaultValue={editingDrive?.targetSemester ?? ''}><option value="">Not specified</option>{[1,2,3,4,5,6,7,8].map((semester) => <option key={semester} value={semester}>{semester}</option>)}</select></label>
            <label className="space-y-1 text-sm font-medium">Publish date<input className="input" name="publishDate" defaultValue={editingDrive?.publishDate ? new Date(editingDrive.publishDate).toISOString().slice(0, 10) : ''} type="date" required /></label>
            <label className="space-y-1 text-sm font-medium">Application deadline<input className="input" name="applicationDeadline" defaultValue={editingDrive?.applicationDeadline ? new Date(editingDrive.applicationDeadline).toISOString().slice(0, 10) : ''} type="date" required /></label>
          </div>
          <label className="block space-y-1 text-sm font-medium">Job description<textarea className="input min-h-28" name="description" defaultValue={editingDrive?.description || ''} minLength="10" required /></label>
          <label className="block space-y-1 text-sm font-medium">Required skills (comma-separated)<input className="input" name="requiredSkills" defaultValue={(editingDrive?.requiredSkills || []).join(', ')} placeholder="JavaScript, React, Node.js" /></label>
          <fieldset className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Eligible branches (select at least one)</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{['CSE','IT','ECE','EEE','ME','CE','Agriculture','Biotechnology','Chemical Engineering','Textile Engineering','Aerospace Engineering','Biomedical Engineering','Food Technology','Environmental Engineering','Petroleum Engineering','Civil Engineering','Electrical Engineering','Mechanical Engineering','Metallurgical Engineering','Instrumentation Engineering','Manufacturing Engineering'].map((branch) => <label key={branch} className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowedBranches" defaultChecked={(editingDrive?.allowedBranches || []).includes(branch)} value={branch} />{branch}</label>)}</div></fieldset>
          <fieldset className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Allowed semesters (optional)</legend><div className="flex flex-wrap gap-4">{[1,2,3,4,5,6,7,8].map((semester) => <label key={semester} className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowedSemesters" defaultChecked={(editingDrive?.allowedSemesters || []).includes(semester)} value={semester} />{semester}</label>)}</div></fieldset>
          <div className="flex flex-wrap gap-2"><button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Saving...' : editingDrive ? 'Update Drive' : 'Submit for approval'}</button><button className="btn-secondary" type="button" disabled={busy} onClick={() => { setShowDriveForm(false); setEditingDrive(null); }}>Cancel</button></div>
        </form>}
        {jobs.length ? <div className="grid gap-3 md:grid-cols-2">{jobs.map((job) => <div className="rounded-lg border p-4" key={job._id}><div className="flex items-center justify-between gap-2"><strong>{job.title}</strong><div className="flex items-center gap-2"><Badge value={job.status} />{profile?.approvalStatus === 'approved' && !['closed', 'cancelled'].includes(job.status?.toLowerCase()) && <button type="button" className="btn-secondary px-3 py-1 text-sm" onClick={() => startEditingDrive(job)}>Edit</button>}</div></div><p className="mt-2 text-sm text-gray-500">{job.location} Â· {job.vacancies} vacancies</p><p className="mt-1 text-xs">Approval: {job.approvalStatus} Â· deadline {new Date(job.applicationDeadline).toLocaleDateString()}</p></div>)}</div> : <p className="text-gray-500">No drives created yet.</p>}
      </div>}
      {tab === 'applications' && <div className="card"><div className="mb-4 grid gap-2 md:grid-cols-6"><input className="input md:col-span-2" placeholder="Search name, roll number, skill" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} /><select className="input" value={filters.jobId} onChange={(e) => setFilters({ ...filters, jobId: e.target.value, page: 1 })}><option value="">All drives</option>{jobs.map((job) => <option key={job._id} value={job._id}>{job.title}</option>)}</select><select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}><option value="">All statuses</option>{statusLabels.map((status) => <option key={status}>{status}</option>)}</select><input className="input" placeholder="Branch" value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value, page: 1 })} /><input className="input" type="number" step="0.1" placeholder="Min CGPA" value={filters.minCgpa} onChange={(e) => setFilters({ ...filters, minCgpa: e.target.value, page: 1 })} /></div><ApplicationTable rows={applicationRows} busy={busy} resumeBusy={resumeBusy} onStatus={updateApplication} onResume={openResume} /><Pager pagination={applications.pagination} onPage={(page) => setFilters({ ...filters, page })} /></div>}
      {tab === 'directory' && <div className="card"><div className="mb-4 grid gap-2 md:grid-cols-5"><input className="input md:col-span-2" placeholder="Search students" value={directoryFilters.search} onChange={(e) => setDirectoryFilters({ ...directoryFilters, search: e.target.value, page: 1 })} /><input className="input" placeholder="Branch" value={directoryFilters.branch} onChange={(e) => setDirectoryFilters({ ...directoryFilters, branch: e.target.value, page: 1 })} /><input className="input" type="number" placeholder="Graduation year" value={directoryFilters.graduationYear} onChange={(e) => setDirectoryFilters({ ...directoryFilters, graduationYear: e.target.value, page: 1 })} /><select className="input" value={directoryFilters.jobId} onChange={(e) => setDirectoryFilters({ ...directoryFilters, jobId: e.target.value, page: 1 })}><option value="">Eligible for any drive</option>{jobs.map((job) => <option key={job._id} value={job._id}>{job.title}</option>)}</select></div><div className="grid gap-3 md:grid-cols-2">{directory.records.map((student) => <div className="rounded-lg border p-4" key={student._id}><strong>{student.fullName}</strong><p className="text-sm">{student.branch} · CGPA {student.cgpa} · {student.graduationYear}</p><p className="text-xs text-gray-500">{(student.skills || []).join(', ') || 'No skills listed'} · resume {student.resumeAvailable ? 'available' : 'not submitted'}</p><p className="mt-2 text-xs">Eligible drives: {student.relevantJobs.map((job) => job.title).join(', ')}</p></div>)}</div><Pager pagination={directory.pagination} onPage={(page) => setDirectoryFilters({ ...directoryFilters, page })} /></div>}
      {tab === 'interviews' && <div className="grid gap-6 lg:grid-cols-2"><form className="card space-y-3" onSubmit={scheduleInterview}><h2 className="text-xl font-bold">Schedule interview</h2><select className="input" name="applicationId" required><option value="">Select application</option>{applicationRows.map((application) => <option key={application._id} value={application._id}>{application.studentId?.fullName} · {application.jobId?.title}</option>)}</select><input className="input" name="round" placeholder="Round (e.g. Technical)" required /><input className="input" name="scheduledAt" type="datetime-local" required /><select className="input" name="mode"><option>Online</option><option>On-campus</option><option>Offline</option></select><input className="input" name="venue" placeholder="Venue" /><input className="input" name="meetingLink" placeholder="Meeting link" /><textarea className="input" name="instructions" placeholder="Instructions" /><button className="btn-primary" disabled={busy}>Schedule</button></form><div className="card"><h2 className="mb-4 text-xl font-bold">Interview progress</h2>{interviews.map((interview) => <div className="border-b py-3" key={interview._id}><strong>{interview.applicationId?.studentId?.fullName || interview.studentId?.fullName || 'Student'}</strong><p className="text-sm">{interview.round} · {new Date(interview.scheduledAt).toLocaleString()} · <Badge value={interview.status} /></p></div>)}</div></div>}
      {tab === 'offers' && <OfferCenter api={api} role="recruiter" applications={applicationRows} />}
      {tab === 'analytics' && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card label="Shortlisting conversion" value={`${dashboard?.shortlistingConversion || 0}%`} /><Card label="Placement conversion" value={`${dashboard?.placementConversion || 0}%`} /><Card label="Interview-stage count" value={(dashboard?.interviewProgress || []).find((item) => item._id === 'scheduled')?.count || 0} /><Card label="Drive applications" value={(dashboard?.driveApplications || []).length} /></div>}
    </main>
  </div>;
}

function ApplicationTable({ rows, busy, resumeBusy, onStatus, onResume }) {
  return rows.length ? <div className="overflow-x-auto"><table className="min-w-full whitespace-nowrap text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3 pr-4">Student</th><th className="pr-4">Branch / CGPA</th><th className="pr-4">Drive</th><th className="pr-4">Applied</th><th className="pr-4">Status</th><th className="pr-4">Resume</th><th>Actions</th></tr></thead><tbody>{rows.map((application) => {
    const viewBusy = resumeBusy[`${application._id}:view`];
    const downloadBusy = resumeBusy[`${application._id}:download`];
    return <tr className="border-b" key={application._id}><td className="py-3 pr-4"><strong>{application.studentId?.fullName}</strong><br /><span className="text-xs">{application.studentId?.rollNumber}</span></td><td className="pr-4">{application.studentId?.branch} / {application.studentId?.cgpa}</td><td className="pr-4">{application.jobId?.title}</td><td className="pr-4">{new Date(application.appliedAt).toLocaleDateString()}</td><td className="pr-4"><Badge value={application.status} /></td><td className="pr-4">{application.resume?.available ? <><span className="text-xs font-medium">Available</span><br /><span className="text-xs text-gray-500">{application.resume.fileName}</span></> : <span className="text-xs text-red-600">Resume not available for this application.</span>}</td><td className="space-x-1">{(nextStatuses[application.status] || []).map((status) => <button className="btn-secondary px-2 py-1 text-xs" disabled={busy} key={status} onClick={() => onStatus(application, status)}>{status}</button>)}{application.resume?.available && <><button title="View resume" className="btn-secondary inline-flex items-center gap-1 px-2 py-1" disabled={viewBusy} onClick={() => onResume(application)}><ExternalLink size={14} />{viewBusy ? 'Opening...' : 'View'}</button><button title="Download resume" className="btn-secondary inline-flex items-center gap-1 px-2 py-1" disabled={downloadBusy} onClick={() => onResume(application, true)}><Download size={14} />{downloadBusy ? 'Downloading...' : 'Download'}</button></>}</td></tr>;
  })}</tbody></table></div> : <p className="text-gray-500">No applications match these filters.</p>;
}

function Pager({ pagination, onPage }) {
  if (!pagination?.totalPages || pagination.totalPages < 2) return null;
  return <div className="mt-4 flex items-center justify-between text-sm"><span>Page {pagination.page} of {pagination.totalPages}</span><div className="space-x-2"><button className="btn-secondary" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</button><button className="btn-secondary" disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Next</button></div></div>;
}

export default RecruiterDashboard;
