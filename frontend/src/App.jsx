import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LogOut, Upload } from 'lucide-react';

const api = axios.create({ baseURL: '/api/v1' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const emptyLogin = { email: '', password: '' };
const emptyStudent = { email: '', password: '', fullName: '', rollNumber: '', phone: '', branch: 'CSE', degree: 'B.Tech', currentSemester: '', cgpa: '', graduationYear: new Date().getFullYear() + 1 };
const emptyRecruiter = { email: '', password: '', fullName: '', designation: '', phone: '', companyName: '', industry: '', location: '', hrName: '', hrEmail: '', contactNumber: '' };
const PREDEFINED_BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE'];
const ADDITIONAL_BRANCHES = [
  'Agriculture', 'Biotechnology', 'Chemical Engineering', 'Textile Engineering',
  'Aerospace Engineering', 'Biomedical Engineering', 'Food Technology',
  'Environmental Engineering', 'Petroleum Engineering',
  'Civil Engineering', 'Electrical Engineering', 'Mechanical Engineering',
  'Metallurgical Engineering', 'Instrumentation Engineering', 'Manufacturing Engineering',
];
const STUDENT_BRANCHES = [...PREDEFINED_BRANCHES, 'Other', ...ADDITIONAL_BRANCHES];

function StatusBadge({ status }) {
  const value = status || 'unknown';
  const styles = {
    active: 'badge-green', approved: 'badge-green', placed: 'badge-green', selected: 'badge-green',
    pending: 'badge-yellow', interview: 'badge-yellow', shortlisted: 'badge-blue',
    rejected: 'badge-red', closed: 'badge-red', inactive: 'badge-red', cancelled: 'badge-red',
    withdrawn: 'badge-gray', 'opted-out': 'badge-gray', 'higher-studies': 'badge-blue',
  };
  return <span className={styles[value] || 'badge-gray'}>{value}</span>;
}

function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('student');
  const [form, setForm] = useState(emptyLogin);
  const [busy, setBusy] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);
  const [otp, setOtp] = useState('');
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const switchMode = (next) => {
    setMode(next);
    setForm(next === 'login' ? emptyLogin : role === 'student' ? emptyStudent : emptyRecruiter);
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    if (!pendingVerification) return;
    setBusy(true);
    try {
      await api.post('/auth/otp/verify', { email: pendingVerification.email, otp });
      toast.success('Email verified. You can now sign in.');
      setPendingVerification(null);
      setOtp('');
      setMode('login');
      setForm(emptyLogin);
    } catch (error) {
      toast.error(error.response?.data?.message || 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (!pendingVerification) return;
    setBusy(true);
    try {
      await api.post('/auth/otp/resend', { email: pendingVerification.email });
      toast.success('A new OTP was sent');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not resend OTP.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : role === 'student' ? '/auth/register/student' : '/auth/register/recruiter';
      const payload = mode === 'login' ? form : {
        ...form,
        currentSemester: form.currentSemester ? Number(form.currentSemester) : undefined,
        cgpa: form.cgpa ? Number(form.cgpa) : undefined,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
      };
      const { data } = await api.post(endpoint, payload);
      if (data.data?.verificationRequired) {
        setPendingVerification({ email: data.data.email });
        setOtp('');
        toast.success('OTP sent to your email');
        return;
      }
      localStorage.setItem('accessToken', data.data.accessToken);
      toast.success(mode === 'login' ? 'Login successful' : 'Registration successful');
      onAuthenticated(data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to complete request.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 px-4 py-10">
    <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
      <div className="mb-7 text-center">
        <img
          src="/assets/campus_logo.png"
          alt="Smart Campus Logo"
          className="mx-auto mb-3 h-16 w-16 rounded-xl object-contain"
        />
        <h1 className="text-2xl font-bold text-gray-900">Smart Campus</h1>
        <p className="mt-1 text-sm text-gray-500">Placement management portal</p>
      </div>
      {pendingVerification ? <div className="space-y-4">
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          Enter the 6-digit OTP sent to <strong>{pendingVerification.email}</strong>.
        </div>
        <form className="space-y-4" onSubmit={verifyOtp}>
          <input className="input text-center text-xl tracking-[0.5em]" name="otp" inputMode="numeric" maxLength="6" pattern="[0-9]{6}" placeholder="6-digit OTP" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button className="btn-primary w-full" type="submit" disabled={busy || otp.length !== 6}>{busy ? 'Verifying...' : 'Verify email'}</button>
        </form>
        <button type="button" className="w-full text-sm font-medium text-primary-700 disabled:text-gray-400" onClick={resendOtp} disabled={busy}>Resend OTP</button>
        <button type="button" className="w-full text-sm text-gray-500" onClick={() => { setPendingVerification(null); setOtp(''); }}>Cancel verification</button>
      </div> : <>
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-gray-100 p-1">
        <button type="button" className={`rounded-md py-2 text-sm font-medium ${mode === 'login' ? 'bg-white shadow' : ''}`} onClick={() => switchMode('login')}>Login</button>
        <button type="button" className={`rounded-md py-2 text-sm font-medium ${mode === 'register' ? 'bg-white shadow' : ''}`} onClick={() => switchMode('register')}>Register</button>
      </div>
      {mode === 'register' && <div className="mb-4 grid grid-cols-2 rounded-lg border border-gray-200 p-1">
        <button type="button" className={`rounded-md py-2 text-sm ${role === 'student' ? 'bg-blue-50 text-primary-700 font-semibold' : ''}`} onClick={() => { setRole('student'); setForm(emptyStudent); }}>Student</button>
        <button type="button" className={`rounded-md py-2 text-sm ${role === 'recruiter' ? 'bg-blue-50 text-primary-700 font-semibold' : ''}`} onClick={() => { setRole('recruiter'); setForm(emptyRecruiter); }}>Recruiter / Company</button>
      </div>}
      <form className="space-y-3" onSubmit={submit}>
        {mode === 'register' && role === 'student' && <>
          <input className="input" name="fullName" placeholder="Full name" required value={form.fullName || ''} onChange={update} />
          <input className="input" name="rollNumber" placeholder="Roll number" required value={form.rollNumber || ''} onChange={update} />
          <input className="input" name="phone" placeholder="Phone number" required value={form.phone || ''} onChange={update} />
          <div className="grid grid-cols-2 gap-3">
            <select className="input" name="branch" value={form.branch} onChange={update}>{STUDENT_BRANCHES.map((branch) => <option key={branch}>{branch}</option>)}</select>
            <select className="input" name="degree" value={form.degree} onChange={update}>{['B.Tech','B.E.','M.Tech','MCA','BCA','Other'].map((degree) => <option key={degree}>{degree}</option>)}</select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input className="input" name="cgpa" type="number" step="0.01" min="0" max="10" placeholder="Enter your CGPA (e.g. 7.5)" required value={form.cgpa} onChange={update} />
            <select className="input" name="currentSemester" required value={form.currentSemester} onChange={update}>
              <option value="" disabled>Select Sem</option>
              {[1,2,3,4,5,6,7,8].map((semester) => <option key={semester} value={semester}>Sem {semester}</option>)}
            </select>
            <input className="input" name="graduationYear" type="number" required value={form.graduationYear} onChange={update} />
          </div>
        </>}
        {mode === 'register' && role === 'recruiter' && <>
          <input className="input" name="fullName" placeholder="Full name" required value={form.fullName || ''} onChange={update} />
          <input className="input" name="designation" placeholder="Designation" required value={form.designation || ''} onChange={update} />
          <input className="input" name="phone" placeholder="Phone number" required value={form.phone || ''} onChange={update} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" name="companyName" placeholder="Company name" required value={form.companyName || ''} onChange={update} />
            <input className="input" name="industry" placeholder="Industry" required value={form.industry || ''} onChange={update} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" name="location" placeholder="Company location" required value={form.location || ''} onChange={update} />
            <input className="input" name="hrName" placeholder="HR name" value={form.hrName || ''} onChange={update} />
          </div>
          <input className="input" name="hrEmail" type="email" placeholder="HR email" value={form.hrEmail || ''} onChange={update} />
          <input className="input" name="contactNumber" placeholder="Company contact" value={form.contactNumber || ''} onChange={update} />
        </>}
        <input className="input" name="email" type="email" placeholder="Email address" required value={form.email || ''} onChange={update} />
        <input className="input" name="password" type="password" minLength="8" placeholder="Password (8+ characters)" required value={form.password || ''} onChange={update} />
        <button className="btn-primary w-full" disabled={busy} type="submit">{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      </>}
    </div>
  </main>;
}

function Shell({ title, role, onLogout, children }) {
  const roleLabel = role === 'admin' ? 'Placement Officer' : role === 'recruiter' ? 'Recruiter / Company' : 'Student';
  return <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white"><CampusLogo className="h-10 w-10" /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-primary-600">{roleLabel}</p><h1 className="text-lg font-bold">{title}</h1></div></div>
        <button className="btn-secondary flex items-center gap-2" onClick={onLogout}><LogOut size={16} /> Sign out</button>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
  </div>;
}

function StatCard({ label, value, tone = 'blue' }) {
  const tones = { blue: 'text-primary-700', green: 'text-emerald-700', amber: 'text-amber-700', slate: 'text-slate-700' };
  return <div className="card"><p className="text-sm text-gray-500">{label}</p><p className={`mt-2 text-3xl font-bold ${tones[tone]}`}>{value}</p></div>;
}

function CampusLogo({ className = 'h-10 w-10' }) {
  return <img
    src="/assets/campus_logo.png"
    alt="Smart Campus"
    className={`${className} rounded-lg object-contain`}
  />;
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between border-b px-6 py-4"><h2 className="text-lg font-bold">{title}</h2><button type="button" className="text-2xl text-gray-400 hover:text-gray-700" onClick={onClose} aria-label="Close">&times;</button></div>
      <div className="p-6">{children}</div>
    </div>
  </div>;
}

function StudentAvatar({ student, size = 'small' }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  const initials = String(student?.fullName || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const small = size === 'small';
  const imageUrl = student?.profilePhotoUrl || '';

  return <>
    {imageUrl && !broken
      ? <button type="button" className={`${small ? 'h-10 w-10' : 'h-24 w-24'} overflow-hidden rounded-full border border-slate-200 bg-slate-100`} onClick={() => { setLoaded(false); setOpen(true); }} aria-label={`View ${student.fullName || 'student'} profile photo`}>
          <img className="h-full w-full object-cover" src={imageUrl} alt={student.fullName || 'Student'} onError={() => setBroken(true)} />
        </button>
      : <button type="button" className={`${small ? 'h-10 w-10 text-xs' : 'h-24 w-24 text-lg'} flex items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700`} aria-label={`${student.fullName || 'Student'} has no profile photo`} disabled>{initials}</button>}
    <Modal open={open} title={`${student.fullName || 'Student'} - Profile Photo`} onClose={() => setOpen(false)}>
      <div className="flex min-h-64 items-center justify-center">
        {!loaded && <p className="text-sm text-gray-500">Loading full-size image...</p>}
        {imageUrl && <img className={`max-h-[70vh] max-w-full rounded-lg object-contain ${loaded ? '' : 'hidden'}`} src={imageUrl} alt={`${student.fullName || 'Student'} profile`} onLoad={() => setLoaded(true)} onError={() => { setLoaded(true); setBroken(true); setOpen(false); }} />}
      </div>
    </Modal>
  </>;
}

function StudentDashboard({ session, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [resume, setResume] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [tab, setTab] = useState('drives');
  const [editing, setEditing] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [ineligibleModal, setIneligibleModal] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/jobs'), api.get('/students/profile'), api.get('/students/applications'), api.get('/resumes'), api.get('/interviews'), api.get('/placements')])
      .then(([jobsData, profileData, applicationsData, resumeData, interviewsData, placementsData]) => {
        setJobs(jobsData.data.data || []);
        setProfile(profileData.data.data);
        setApplications(applicationsData.data.data || []);
        setResume(resumeData.data.data);
        setInterviews(interviewsData.data.data || []);
        setPlacements(placementsData.data.data || []);
      }).catch((error) => toast.error(error.response?.data?.message || 'Could not load dashboard data.'));
  }, []);

  const apply = async (jobId) => {
    const job = jobs.find((item) => item._id === jobId);
    if (job?.eligibility?.eligible === false) {
      setIneligibleModal({
        reasons: job.eligibility.reasons || [],
      });
      return;
    }
    try {
      await api.post('/applications', { jobId });
      toast.success('Application submitted');
      const applicationsResponse = await api.get('/students/applications');
      setApplications(applicationsResponse.data.data || []);
    } catch (error) {
      const response = error.response?.data;
      if (response?.errors?.length) {
        setIneligibleModal({ reasons: response.errors });
      } else {
        toast.error(response?.message || 'Application failed.');
      }
    }
  };

  const withdrawApplication = async (application) => {
    if (!window.confirm(`Withdraw your application for ${application.jobId?.title || 'this drive'}?`)) return;
    setWithdrawBusy(true);
    try {
      const response = await api.patch(`/applications/${application._id}/withdraw`, {});
      setApplications((current) => current.map((item) => item._id === application._id ? response.data.data : item));
      toast.success('Application withdrawn');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not withdraw application.');
    } finally {
      setWithdrawBusy(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    payload.currentSemester = Number(payload.currentSemester);
    payload.cgpa = Number(payload.cgpa);
    payload.graduationYear = Number(payload.graduationYear);
    payload.backlogs = { count: Number(payload.backlogCount), details: payload.backlogDetails || '' };
    payload.skills = String(payload.skills || '').split(',').map((item) => item.trim()).filter(Boolean);
    delete payload.backlogCount;
    delete payload.backlogDetails;
    try {
      const response = await api.patch('/students/profile', payload);
      setProfile(response.data.data);
      setEditing(false);
      toast.success('Profile updated');
    } catch (error) { toast.error(error.response?.data?.message || 'Profile update failed.'); }
  };

  const uploadResume = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('resume', file);
    try {
      const response = await api.post('/resumes', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResume(response.data.data);
      toast.success('Resume uploaded and parsed');
    } catch (error) { toast.error(error.response?.data?.message || 'Resume upload failed.'); }
  };

  const selectProfilePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, JPG, PNG, or WebP images are allowed.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile photo must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }
    if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);
    setProfilePhotoPreview(URL.createObjectURL(file));
  };

  const uploadProfilePhoto = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const file = formElement.elements.photo?.files?.[0];
    if (!file) {
      toast.error('Select a profile photo first.');
      return;
    }
    const form = new FormData();
    form.append('photo', file);
    setProfilePhotoBusy(true);
    try {
      const response = await api.post('/students/profile/photo', form);
      const uploadedUrl = response.data?.data?.profilePhotoUrl;
      if (!uploadedUrl) throw new Error('Upload succeeded but the server did not return an image URL.');
      setProfile((current) => ({ ...current, profilePhotoUrl: uploadedUrl }));
      if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);
      setProfilePhotoPreview('');
      formElement.reset();
      toast.success('Profile photo uploaded');
    } catch (error) {
      if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);
      setProfilePhotoPreview('');
      toast.error(error.response?.data?.message || error.message || 'Profile photo upload failed.');
    } finally {
      setProfilePhotoBusy(false);
    }
  };

  const activeApplications = applications.filter((application) => application.status !== 'withdrawn');
  const appliedJobIds = new Set(activeApplications.map((application) => application.jobId?._id || application.jobId));
  return <Shell title="Student Dashboard" role="student" onLogout={onLogout}>
    <div className="mb-6 flex flex-wrap gap-2">
      {[['drives','Placement drives'],['applications','My applications'],['interviews','Interviews'],['placements','Offer & placement'],['profile','My profile']].map(([id,label]) => <button key={id} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border'}`} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    {tab === 'drives' && <>
      <div className="mb-6 grid gap-4 md:grid-cols-3"><StatCard label="Student" value={profile?.fullName || session.user?.email} /><StatCard label="Available drives" value={jobs.length} tone="green" /><StatCard label="Applications" value={activeApplications.length} tone="amber" /></div>
      <div className="grid gap-4 lg:grid-cols-2">{jobs.length ? jobs.map((job) => <article className="card" key={job._id}>
        <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">{job.title}</h3><p className="text-sm text-gray-500">{job.companyId?.name || 'Company'} · {job.location}</p></div><div className="flex flex-col items-end gap-2"><StatusBadge status={job.jobType} />{job.eligibility && <span className={job.eligibility.eligible ? 'badge-green' : 'badge-red'}>{job.eligibility.eligible ? 'Eligible' : 'Not Eligible'}</span>}</div></div>
        <p className="mt-4 line-clamp-3 text-sm text-gray-600">{job.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">{job.requiredSkills?.map((skill) => <span className="badge-gray" key={skill}>{skill}</span>)}</div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-600"><p>Minimum CGPA: {job.minCgpa}</p><p>Vacancies: {job.vacancies}</p><p>Deadline: {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString() : '—'}</p><p>Package: {job.package?.max ? `${job.package.max} ${job.package.currency || 'INR'}` : 'Not specified'}</p></div>
        <button className="btn-primary mt-5" onClick={() => apply(job._id)} disabled={appliedJobIds.has(job._id)}> {appliedJobIds.has(job._id) ? 'Applied' : 'Apply now'}</button>
      </article>) : <div className="card text-sm text-gray-500">No active drives are available yet.</div>}</div>
      <Modal open={Boolean(ineligibleModal)} title="Eligibility check" onClose={() => setIneligibleModal(null)}>
        <p className="font-medium text-red-700">You are not eligible for this job.</p>
        {ineligibleModal?.reasons?.length > 0 && <>
          <p className="mt-3 text-sm text-gray-700">You are not eligible for this job because:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {ineligibleModal.reasons.map((reason, index) => <li key={`${reason}-${index}`}>{typeof reason === 'string' ? reason : reason.message}</li>)}
          </ul>
        </>}
        <div className="mt-5 flex justify-end"><button type="button" className="btn-secondary" onClick={() => setIneligibleModal(null)}>Close</button></div>
      </Modal>
    </>}
    {tab === 'applications' && <div className="card overflow-x-auto"><h2 className="mb-4 text-xl font-bold">My applications</h2>{applications.length ? <table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Drive</th><th>Company</th><th>Status</th><th>Applied</th><th>Action</th></tr></thead><tbody>{applications.map((application) => <tr className="border-b" key={application._id}><td className="py-3 font-medium">{application.jobId?.title || '—'}</td><td>{application.companyId?.name || '—'}</td><td><StatusBadge status={application.status} /></td><td>{application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : '—'}</td><td>{['applied','shortlisted','interview'].includes(application.status) ? <button type="button" className="btn-danger py-1 text-xs" disabled={withdrawBusy} onClick={() => withdrawApplication(application)}>Withdraw</button> : <span className="text-xs text-gray-400">—</span>}</td></tr>)}</tbody></table> : <p className="text-gray-500">You have not applied to any drives yet.</p>}</div>}
    {tab === 'interviews' && <div className="card"><h2 className="mb-4 text-xl font-bold">Interview schedule</h2>{interviews.length ? <div className="space-y-3">{interviews.map((interview) => <div className="rounded-lg border p-4" key={interview._id}><div className="flex justify-between gap-3"><p className="font-medium">{interview.round} · {interview.jobId?.title || 'Interview'}</p><StatusBadge status={interview.status} /></div><p className="mt-2 text-sm text-gray-500">{new Date(interview.scheduledAt).toLocaleString()} · {interview.mode}{interview.venue ? ` · ${interview.venue}` : ''}</p>{interview.meetingLink && <a className="mt-2 inline-block text-sm text-primary-700" href={interview.meetingLink} target="_blank" rel="noreferrer">Join meeting</a>}</div>)}</div> : <p className="text-sm text-gray-500">No interviews scheduled.</p>}</div>}
    {tab === 'placements' && <div className="card"><h2 className="mb-4 text-xl font-bold">Placement history</h2>{placements.length ? placements.map((placement) => <div className="rounded-lg border p-4" key={placement._id}><p className="font-medium">{placement.jobRole || placement.jobId?.title || 'Not Available'}</p><p className="mt-1 text-sm text-gray-500">{placement.companyId?.name || 'Company Not Available'}</p><p className="mt-1 text-xs text-gray-500">{placement.jobLocation || 'Location Not Available'}{placement.package ? ` · ${placement.package} INR` : ''}</p><StatusBadge status="placed" /></div>) : <p className="text-sm text-gray-500">No placement record yet.</p>}</div>}
    {tab === 'profile' && <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="card">{editing ? <form onSubmit={saveProfile} className="space-y-4"><h2 className="text-xl font-bold">Edit profile</h2><div className="grid gap-3 md:grid-cols-2"><input className="input" name="fullName" defaultValue={profile?.fullName || ''} placeholder="Full name" /><input className="input" name="phone" defaultValue={profile?.phone || ''} placeholder="Phone" /><select className="input" name="branch" defaultValue={profile?.branch || 'CSE'}><option value="" disabled>Select branch</option>{STUDENT_BRANCHES.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select><input className="input" name="cgpa" type="number" step="0.01" min="0" max="10" defaultValue={profile?.cgpa || ''} placeholder="Enter your CGPA (e.g. 7.5)" /><input className="input" name="graduationYear" type="number" defaultValue={profile?.graduationYear || ''} placeholder="Graduation year" /><select className="input" name="currentSemester" defaultValue={profile?.currentSemester || ''}><option value="" disabled>Select Sem</option>{[1,2,3,4,5,6,7,8].map((semester) => <option key={semester} value={semester}>Sem {semester}</option>)}</select><input className="input" name="skills" defaultValue={(profile?.skills || []).join(', ')} placeholder="Skills (comma separated)" /><input className="input" name="backlogCount" type="number" defaultValue={profile?.backlogs?.count || 0} placeholder="Backlogs" /><input className="input" name="backlogDetails" defaultValue={profile?.backlogs?.details || ''} placeholder="Backlog details" /></div><button className="btn-primary" type="submit">Save profile</button><button className="btn-secondary ml-2" type="button" onClick={() => setEditing(false)}>Cancel</button></form> : <><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">Placement profile</h2><button className="btn-secondary" onClick={() => setEditing(true)}>Edit profile</button></div><div className="mb-5"><StudentAvatar student={profile} size="large" /></div><dl className="grid gap-4 text-sm md:grid-cols-2"><div><dt className="text-gray-500">Name</dt><dd className="font-medium">{profile?.fullName || '—'}</dd></div><div><dt className="text-gray-500">Branch / Degree</dt><dd className="font-medium">{profile?.branch} / {profile?.degree}</dd></div><div><dt className="text-gray-500">CGPA</dt><dd className="font-medium">{profile?.cgpa}</dd></div><div><dt className="text-gray-500">Graduation year</dt><dd className="font-medium">{profile?.graduationYear}</dd></div><div><dt className="text-gray-500">Backlogs</dt><dd className="font-medium">{profile?.backlogs?.count ?? 0}</dd></div><div><dt className="text-gray-500">Placement status</dt><dd><StatusBadge status={profile?.placementStatus} /></dd></div></dl><div className="mt-5 flex flex-wrap gap-2">{profile?.skills?.map((skill) => <span className="badge-gray" key={skill}>{skill}</span>)}</div></>}</div>
      <div className="space-y-6">
        <div className="card"><h2 className="mb-4 text-xl font-bold">Profile Photo</h2>{profilePhotoPreview && <img className="mb-4 h-32 w-32 rounded-full object-cover" src={profilePhotoPreview} alt="Profile photo preview" />}<form onSubmit={uploadProfilePhoto} className="space-y-3"><label className="btn-secondary inline-flex cursor-pointer items-center gap-2"><Upload size={16} /> Choose image<input name="photo" className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={selectProfilePhoto} /></label><button className="btn-primary block" type="submit" disabled={profilePhotoBusy}>{profilePhotoBusy ? 'Uploading...' : 'Upload Profile Photo'}</button><p className="text-xs text-gray-500">JPEG, JPG, PNG, or WebP. Maximum 5 MB.</p></form></div>
        <div className="card"><h2 className="mb-4 text-xl font-bold">Resume</h2>{resume ? <><p className="break-all text-sm font-medium">{resume.fileName}</p><p className="mt-1 text-sm text-gray-500">{resume.extractedSkills?.join(', ') || 'No skills extracted'}</p></> : <p className="text-sm text-gray-500">No resume uploaded.</p>}<label className="btn-primary mt-5 inline-flex cursor-pointer items-center gap-2"><Upload size={16} /> Upload PDF<input className="hidden" type="file" accept=".pdf,application/pdf" onChange={uploadResume} /></label></div>
      </div>
    </div>}
  </Shell>;
}

function RecruiterDashboard({ session, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [tab, setTab] = useState('overview');
  const [interviews, setInterviews] = useState([]);
  const [editJob, setEditJob] = useState(null);
  const [deleteJob, setDeleteJob] = useState(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [additionalBranches, setAdditionalBranches] = useState([]);
  const [additionalBranchSearch, setAdditionalBranchSearch] = useState('');
  const [editAdditionalBranches, setEditAdditionalBranches] = useState([]);
  const [editAdditionalBranchSearch, setEditAdditionalBranchSearch] = useState('');
  useEffect(() => {
    Promise.all([api.get('/recruiters/profile'), api.get('/applications'), api.get('/jobs?all=true'), api.get('/interviews')])
      .then(([profileData, applicationsData, jobsData, interviewsData]) => {
        setProfile(profileData.data.data);
        setApplications(applicationsData.data.data || []);
        setJobs((jobsData.data.data || []).filter((job) => job.createdBy === session.user.id));
        setInterviews(interviewsData.data.data || []);
      }).catch((error) => toast.error(error.response?.data?.message || 'Could not load recruiter data.'));
  }, [session.user.id]);

  const createJob = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const publishDate = String(form.get('publishDate') || '');
    const applicationDeadline = String(form.get('applicationDeadline') || '');
    if (publishDate && applicationDeadline && applicationDeadline < publishDate) {
      toast.error('Application deadline cannot be earlier than the drive post date.');
      return;
    }
    const selectedBranches = [...new Set([...form.getAll('allowedBranches'), ...additionalBranches])];
    if (selectedBranches.length === 0) {
      toast.error('Select at least one eligible branch.');
      return;
    }
    if (selectedBranches.includes('Other')) {
      toast.error('Other cannot be used as a wildcard eligible branch.');
      return;
    }
    const payload = {
      title: form.get('title'),
      description: form.get('description'),
      location: form.get('location'),
      jobType: form.get('jobType'),
      requiredSkills: String(form.get('requiredSkills') || '').split(',').map((item) => item.trim()).filter(Boolean),
      publishDate,
      applicationDeadline: form.get('applicationDeadline'),
      minCgpa: Number(form.get('minCgpa') || 0),
      maxBacklogs: Number(form.get('maxBacklogs') || 0),
      vacancies: Number(form.get('vacancies')),
      targetGraduationYear: Number(form.get('targetGraduationYear')),
      targetSemester: form.get('targetSemester') ? Number(form.get('targetSemester')) : undefined,
      allowedBranches: [...new Set([...form.getAll('allowedBranches'), ...additionalBranches])],
      package: {
        min: Number(form.get('packageMin') || 0),
        max: Number(form.get('packageMax') || 0),
        currency: 'INR',
      },
    };
    payload.publishDate = new Date(`${payload.publishDate}T00:00:00.000Z`).toISOString();
    payload.applicationDeadline = new Date(payload.applicationDeadline).toISOString();
    try {
      await api.post('/jobs', payload);
      toast.success('Drive submitted for placement officer approval');
      event.currentTarget.reset();
      setAdditionalBranches([]);
      setAdditionalBranchSearch('');
      const jobsResponse = await api.get('/jobs?all=true');
      setJobs((jobsResponse.data.data || []).filter((job) => job.createdBy === session.user.id));
    } catch (error) {
      const response = error.response?.data;
      const fieldError = response?.errors?.[0];
      toast.error(fieldError ? `${fieldError.field}: ${fieldError.message}` : response?.message || 'Could not create drive.');
    }
  };

  const updateApplication = async (id, status) => {
    try {
      await api.patch(`/applications/${id}/status`, { status });
      setApplications((current) => current.map((item) => item._id === id ? { ...item, status } : item));
      toast.success(`Application marked ${status}`);
    } catch (error) { toast.error(error.response?.data?.message || 'Status update failed.'); }
  };

  const openEditDrive = (job) => {
    const additional = (job.allowedBranches || []).filter((branch) => ADDITIONAL_BRANCHES.includes(branch));
    setEditAdditionalBranches(additional);
    setEditAdditionalBranchSearch('');
    setEditJob(job);
  };

  const saveDriveEdit = async (event) => {
    event.preventDefault();
    if (!editJob) return;
    setDriveBusy(true);
    const form = new FormData(event.currentTarget);
    const publishDate = String(form.get('publishDate') || '');
    const applicationDeadline = String(form.get('applicationDeadline') || '');
    if (publishDate && applicationDeadline && applicationDeadline < publishDate) {
      toast.error('Application deadline cannot be earlier than the drive post date.');
      setDriveBusy(false);
      return;
    }
    const selectedBranches = [...new Set([...form.getAll('allowedBranches'), ...editAdditionalBranches])];
    if (selectedBranches.length === 0) {
      toast.error('Select at least one eligible branch.');
      setDriveBusy(false);
      return;
    }
    if (selectedBranches.includes('Other')) {
      toast.error('Other cannot be used as a wildcard eligible branch.');
      setDriveBusy(false);
      return;
    }
    const payload = {
      title: form.get('title'),
      description: form.get('description'),
      location: form.get('location'),
      jobType: form.get('jobType'),
      requiredExperience: form.get('requiredExperience'),
      requiredSkills: String(form.get('requiredSkills') || '').split(',').map((item) => item.trim()).filter(Boolean),
      publishDate: publishDate ? new Date(`${publishDate}T00:00:00.000Z`).toISOString() : undefined,
      applicationDeadline: new Date(form.get('applicationDeadline')).toISOString(),
      minCgpa: Number(form.get('minCgpa') || 0),
      maxBacklogs: Number(form.get('maxBacklogs') || 0),
      vacancies: Number(form.get('vacancies')),
      targetGraduationYear: Number(form.get('targetGraduationYear')),
      targetSemester: form.get('targetSemester') ? Number(form.get('targetSemester')) : undefined,
      allowedBranches: [...new Set([...form.getAll('allowedBranches'), ...editAdditionalBranches])],
      package: {
        min: Number(form.get('packageMin') || 0),
        max: Number(form.get('packageMax') || 0),
        currency: 'INR',
      },
    };
    try {
      const response = await api.patch(`/jobs/${editJob._id}`, payload);
      setJobs((current) => current.map((job) => job._id === editJob._id ? response.data.data : job));
      setEditJob(null);
      toast.success('Drive updated; approval is required again');
    } catch (error) {
      const response = error.response?.data;
      const fieldError = response?.errors?.[0];
      toast.error(fieldError ? `${fieldError.field}: ${fieldError.message}` : response?.message || 'Drive update failed.');
    } finally {
      setDriveBusy(false);
    }
  };

  const changeDriveStatus = async (id, status) => {
    setDriveBusy(true);
    try {
      const response = await api.patch(`/jobs/${id}/status`, { status });
      setJobs((current) => current.map((job) => job._id === id ? response.data.data : job));
      toast.success(`Drive marked ${status}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Drive status update failed.');
    } finally {
      setDriveBusy(false);
    }
  };

  const deleteDrive = async () => {
    if (!deleteJob) return;
    setDriveBusy(true);
    try {
      const response = await api.delete(`/jobs/${deleteJob._id}`);
      if (response.data.data.cancelled) {
        setJobs((current) => current.map((job) => job._id === deleteJob._id ? { ...job, status: 'cancelled', approvalStatus: 'rejected', isPublished: false } : job));
      } else {
        setJobs((current) => current.filter((job) => job._id !== deleteJob._id));
      }
      setDeleteJob(null);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Drive deletion failed.');
    } finally {
      setDriveBusy(false);
    }
  };

  return <Shell title="Recruiter Dashboard" role="recruiter" onLogout={onLogout}>
    <div className="mb-6 flex flex-wrap gap-2">{[['overview','Overview'],['jobs','Post a drive'],['applications','Applicants']].map(([id,label]) => <button key={id} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border'}`} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'overview' && <>
      <div className="mb-6 grid gap-4 md:grid-cols-3"><StatCard label="Company" value={profile?.companyId?.name || 'Pending approval'} /><StatCard label="Total applicants" value={applications.length} tone="green" /><StatCard label="Open drives" value={jobs.filter((job) => job.status === 'active').length} tone="amber" /></div>
      <div className="card"><h2 className="mb-4 text-xl font-bold">Company & approval status</h2><dl className="grid gap-4 text-sm md:grid-cols-3"><div><dt className="text-gray-500">Recruiter</dt><dd className="font-medium">{profile?.fullName}</dd></div><div><dt className="text-gray-500">Designation</dt><dd className="font-medium">{profile?.designation}</dd></div><div><dt className="text-gray-500">Approval</dt><dd><StatusBadge status={profile?.approvalStatus} /></dd></div></dl></div>
    </>}
    {tab === 'jobs' && <div className="grid gap-6 lg:grid-cols-[2fr_1fr]"><form className="card space-y-4" onSubmit={createJob}><h2 className="text-xl font-bold">Create placement drive</h2><input className="input" name="title" placeholder="Job title" minLength="2" required /><textarea className="input min-h-24" name="description" placeholder="Job description (minimum 10 characters)" minLength="10" required /><div className="grid gap-3 md:grid-cols-2"><input className="input" name="location" placeholder="Location" minLength="2" required /><input className="input" name="jobType" list="jobTypes" placeholder="Job type" defaultValue="Full-time" /><datalist id="jobTypes"><option>Full-time</option><option>Internship</option><option>Contract</option></datalist><input className="input" name="requiredSkills" placeholder="Required skills (comma separated)" /><div className="grid gap-2"><label className="label" htmlFor="publishDate">Drive Post Date</label><input id="publishDate" className="input" name="publishDate" type="date" aria-label="Select Drive Post Date" min={new Date().toISOString().slice(0, 10)} required /></div><div className="grid gap-2"><label className="label" htmlFor="applicationDeadline">Application Deadline</label><input id="applicationDeadline" className="input" name="applicationDeadline" type="date" aria-label="Select Application Deadline" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} required /></div></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><input className="input" name="minCgpa" type="number" step="0.1" min="0" max="10" placeholder="Min CGPA" defaultValue="0" /><input className="input" name="maxBacklogs" type="number" min="0" placeholder="Max backlogs" defaultValue="0" /><input className="input" name="vacancies" type="number" min="1" placeholder="Vacancies" required defaultValue="1" /><input className="input" name="targetGraduationYear" type="number" min={new Date().getFullYear()} placeholder="Graduation year" required /></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3"><input className="input" name="packageMin" type="number" min="0" placeholder="Package minimum" /><input className="input" name="packageMax" type="number" min="0" placeholder="Package maximum" /><select className="input" name="targetSemester" aria-label="Select Sem"><option value="">Select Sem</option>{[1,2,3,4,5,6,7,8].map((semester) => <option key={semester} value={semester}>Sem {semester}</option>)}</select></div>    <div><p className="label">Allowed branches</p><div className="flex flex-wrap gap-3">{PREDEFINED_BRANCHES.map((branch) => <label className="text-sm" key={branch}><input type="checkbox" name="allowedBranches" value={branch} className="mr-1" />{branch}</label>)}</div></div>
    <div><p className="label">Additional Eligible Branches</p><input className="input" type="search" value={additionalBranchSearch} onChange={(event) => setAdditionalBranchSearch(event.target.value)} placeholder="Search additional branches" />{additionalBranchSearch && <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border bg-white p-1">{ADDITIONAL_BRANCHES.filter((branch) => branch.toLowerCase().includes(additionalBranchSearch.toLowerCase()) && !additionalBranches.includes(branch)).map((branch) => <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-blue-50" key={branch} onClick={() => { setAdditionalBranches((current) => [...current, branch]); setAdditionalBranchSearch(''); }}>{branch}</button>)}</div>}<div className="mt-2 flex flex-wrap gap-2">{additionalBranches.map((branch) => <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800" key={branch}>{branch}<button type="button" className="ml-1 text-blue-700 hover:text-blue-950" aria-label={`Remove ${branch}`} onClick={() => setAdditionalBranches((current) => current.filter((item) => item !== branch))}>&times;</button></span>)}</div></div><button className="btn-primary" type="submit" disabled={driveBusy}>Submit for approval</button></form><div className="card"><h2 className="mb-4 text-xl font-bold">My drives</h2><div className="space-y-3">{jobs.length ? jobs.map((job) => <div className="rounded-lg border p-3" key={job._id}><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{job.title}</p><div className="mt-2 flex gap-2"><StatusBadge status={job.status} /><StatusBadge status={job.approvalStatus} /></div></div></div><div className="mt-3 flex flex-wrap gap-2">    <button type="button" className="btn-secondary py-1 text-xs" onClick={() => openEditDrive(job)} disabled={job.status === 'closed' || job.status === 'cancelled'}>Edit</button><select className="input w-28 py-1 text-xs" value={job.status} disabled={driveBusy} onChange={(event) => changeDriveStatus(job._id, event.target.value)}><option value="draft">Draft</option><option value="pending">Pending</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option></select><button type="button" className="btn-danger py-1 text-xs" onClick={() => setDeleteJob(job)} disabled={driveBusy}>Delete</button></div></div>) : <p className="text-sm text-gray-500">No drives created yet.</p>}</div></div></div>}
    <Modal open={Boolean(editJob)} title="Edit placement drive" onClose={() => setEditJob(null)}>
      {editJob && <form className="space-y-4" onSubmit={saveDriveEdit}>
        <input className="input" name="title" defaultValue={editJob.title} minLength="2" required />
        <textarea className="input min-h-24" name="description" defaultValue={editJob.description} minLength="10" required />
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input" name="location" defaultValue={editJob.location} minLength="2" required />
          <select className="input" name="jobType" defaultValue={editJob.jobType}><option>Full-time</option><option>Internship</option><option>Contract</option></select>
          <input className="input" name="requiredSkills" defaultValue={(editJob.requiredSkills || []).join(', ')} placeholder="Required skills" />
          <input className="input" name="requiredExperience" defaultValue={editJob.requiredExperience || ''} placeholder="Required experience" />
          <input className="input" name="publishDate" type="date" aria-label="Select Drive Post Date" defaultValue={editJob.publishDate ? new Date(editJob.publishDate).toISOString().slice(0,10) : ''} required />
          <input className="input" name="applicationDeadline" type="date" aria-label="Select Application Deadline" defaultValue={editJob.applicationDeadline ? new Date(editJob.applicationDeadline).toISOString().slice(0,10) : ''} min={new Date(Date.now() + 86400000).toISOString().slice(0,10)} required />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input className="input" name="minCgpa" type="number" step="0.1" min="0" max="10" defaultValue={editJob.minCgpa ?? 0} placeholder="Minimum CGPA" />
          <input className="input" name="maxBacklogs" type="number" min="0" defaultValue={editJob.maxBacklogs ?? 0} placeholder="Max backlogs" />
          <input className="input" name="vacancies" type="number" min="1" defaultValue={editJob.vacancies} required placeholder="Vacancies" />
          <input className="input" name="targetGraduationYear" type="number" min={new Date().getFullYear()} defaultValue={editJob.targetGraduationYear} required placeholder="Passing batch" />
        </div>
        <select className="input" name="targetSemester" defaultValue={editJob.targetSemester || ''} aria-label="Select Sem">
          <option value="">Select Sem</option>
          {[1,2,3,4,5,6,7,8].map((semester) => <option key={semester} value={semester}>Sem {semester}</option>)}
        </select>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input" name="packageMin" type="number" min="0" defaultValue={editJob.package?.min ?? 0} placeholder="Package minimum" />
          <input className="input" name="packageMax" type="number" min="0" defaultValue={editJob.package?.max ?? 0} placeholder="Package / stipend maximum" />
        </div>
        <div><p className="label">Eligible branches</p><div className="flex flex-wrap gap-3">{PREDEFINED_BRANCHES.map((branch) => <label className="text-sm" key={branch}><input type="checkbox" name="allowedBranches" value={branch} className="mr-1" defaultChecked={(editJob.allowedBranches || []).includes(branch)} />{branch}</label>)}</div></div>
        <div><p className="label">Additional Eligible Branches</p><input className="input" type="search" value={editAdditionalBranchSearch} onChange={(event) => setEditAdditionalBranchSearch(event.target.value)} placeholder="Search additional branches" />{editAdditionalBranchSearch && <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border bg-white p-1">{ADDITIONAL_BRANCHES.filter((branch) => branch.toLowerCase().includes(editAdditionalBranchSearch.toLowerCase()) && !editAdditionalBranches.includes(branch)).map((branch) => <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-blue-50" key={branch} onClick={() => { setEditAdditionalBranches((current) => [...current, branch]); setEditAdditionalBranchSearch(''); }}>{branch}</button>)}</div>}<div className="mt-2 flex flex-wrap gap-2">{editAdditionalBranches.map((branch) => <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800" key={branch}>{branch}<button type="button" className="ml-1 text-blue-700 hover:text-blue-950" aria-label={`Remove ${branch}`} onClick={() => setEditAdditionalBranches((current) => current.filter((item) => item !== branch))}>&times;</button></span>)}</div></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEditJob(null)} disabled={driveBusy}>Cancel</button><button type="submit" className="btn-primary" disabled={driveBusy}>{driveBusy ? 'Saving...' : 'Save changes'}</button></div>
      </form>}
    </Modal>
    <Modal open={Boolean(deleteJob)} title="Delete placement drive" onClose={() => setDeleteJob(null)}>
      <p className="text-sm text-gray-600">Delete <strong>{deleteJob?.title}</strong>? If applications exist, the drive will be safely cancelled and application history will be preserved.</p>
      <div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setDeleteJob(null)} disabled={driveBusy}>Cancel</button><button type="button" className="btn-danger" onClick={deleteDrive} disabled={driveBusy}>{driveBusy ? 'Processing...' : 'Confirm delete'}</button></div>
    </Modal>
    {tab === 'applications' && <div className="card overflow-x-auto"><h2 className="mb-4 text-xl font-bold">Candidates</h2>{applications.length ? <table className="min-w-full whitespace-nowrap text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3 pr-4">Student Name</th><th className="pr-4">Email ID</th><th className="pr-4">Roll Number</th><th className="pr-4">Branch</th><th className="pr-4">Drive</th><th className="pr-4">CGPA</th><th className="pr-4">Status</th><th>Action</th></tr></thead><tbody>{applications.map((application) => <tr className="border-b" key={application._id}><td className="py-3 pr-4 font-medium">{application.studentId?.fullName || 'N/A'}</td><td className="pr-4">{application.studentId?.userId?.email || 'N/A'}</td><td className="pr-4">{application.studentId?.rollNumber || 'N/A'}</td><td className="pr-4">{application.studentId?.branch || 'N/A'}</td><td className="pr-4">{application.jobId?.title || 'N/A'}</td><td className="pr-4">{application.studentId?.cgpa ?? 'N/A'}</td><td className="pr-4"><StatusBadge status={application.status} /></td><td><select className="input min-w-32 py-1" value={application.status} onChange={(event) => updateApplication(application._id, event.target.value)}><option value="applied">Applied</option><option value="shortlisted">Shortlisted</option><option value="interview">Interview</option><option value="selected">Selected</option><option value="rejected">Rejected</option></select></td></tr>)}</tbody></table> : <p className="text-gray-500">No applicants yet.</p>}</div>}
  </Shell>;
}

function AdminDashboard({ onLogout }) {
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [tab, setTab] = useState('overview');
  const [notification, setNotification] = useState({ audience: 'students', subject: '', message: '' });
  const [notificationRecipientIds, setNotificationRecipientIds] = useState([]);
  const [placementStudent, setPlacementStudent] = useState(null);
  const [placementBusy, setPlacementBusy] = useState(false);
  const [placedStudents, setPlacedStudents] = useState([]);
  const [placedFilters, setPlacedFilters] = useState({ search: '', branch: '', passingBatch: '', sort: 'date-desc' });
  useEffect(() => {
    Promise.all([api.get('/admin/dashboard'), api.get('/admin/students'), api.get('/admin/companies'), api.get('/recruiters'), api.get('/admin/jobs'), api.get('/admin/applications'), api.get('/admin/placed-students')])
      .then(([statsData, studentsData, companiesData, recruitersData, jobsData, applicationsData, placedData]) => {
        setStats(statsData.data.data); setStudents(studentsData.data.data || []); setCompanies(companiesData.data.data || []);
        setRecruiters(recruitersData.data.data || []); setJobs(jobsData.data.data || []); setApplications(applicationsData.data.data || []);
        setPlacedStudents(placedData.data.data || []);
      }).catch((error) => toast.error(error.response?.data?.message || 'Could not load admin data.'));
  }, []);

  const setCompanyStatus = async (id, status) => {
    try { await api.patch(`/admin/companies/${id}/status`, { status }); setCompanies((current) => current.map((item) => item._id === id ? { ...item, status } : item)); toast.success(`Company marked ${status}`); }
    catch (error) { toast.error(error.response?.data?.message || 'Company update failed.'); }
  };
  const setRecruiterApproval = async (id, approvalStatus) => {
    try { await api.patch(`/recruiters/${id}/approval`, { approvalStatus }); setRecruiters((current) => current.map((item) => item._id === id ? { ...item, approvalStatus } : item)); toast.success(`Recruiter marked ${approvalStatus}`); }
    catch (error) { toast.error(error.response?.data?.message || 'Recruiter update failed.'); }
  };
  const setJobApproval = async (id, approvalStatus) => {
    try { await api.patch(`/admin/jobs/${id}/approval`, { approvalStatus }); setJobs((current) => current.map((item) => item._id === id ? { ...item, approvalStatus, status: approvalStatus === 'approved' ? 'active' : 'closed', isPublished: approvalStatus === 'approved' } : item)); toast.success(`Drive marked ${approvalStatus}`); }
    catch (error) { toast.error(error.response?.data?.message || 'Drive update failed.'); }
  };

  const updatePlacementStatus = async (event) => {
    event.preventDefault();
    if (!placementStudent) return;
    setPlacementBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      placementStatus: form.get('placementStatus'),
      reason: form.get('reason'),
      companyId: form.get('companyId') || undefined,
      jobRole: form.get('jobRole') || undefined,
      placementDetails: form.get('placementDetails'),
      package: Number(form.get('package') || 0),
    };
    try {
      const response = await api.patch(`/admin/students/${placementStudent._id}/placement-status`, payload);
      setStudents((current) => current.map((student) => student._id === placementStudent._id ? response.data.data : student));
      const [dashboardResponse, applicationsResponse, placedResponse] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/applications'),
        api.get('/admin/placed-students'),
      ]);
      setStats(dashboardResponse.data.data);
      setApplications(applicationsResponse.data.data || []);
      setPlacedStudents(placedResponse.data.data || []);
      setPlacementStudent(null);
      toast.success('Placement status updated');
    } catch (error) {
      const response = error.response?.data;
      toast.error(response?.errors?.[0]?.message || response?.message || 'Placement status update failed.');
    } finally {
      setPlacementBusy(false);
    }
  };
  const sendNotification = async (event) => {
    event.preventDefault();
    try {
      if (notification.audience === 'students' || notification.audience === 'recruiters') {
        const response = await api.post('/notifications/bulk', notification);
        toast.success(`Notification sent to ${response.data.data.recipients} recipients`);
      } else {
        if (!notificationRecipientIds.length) throw new Error('Select at least one recipient');
        const response = await api.post('/notifications/send', {
          recipientType: notification.audience,
          recipientIds: notificationRecipientIds,
          subject: notification.subject,
          message: notification.message,
        });
        toast.success(`Notification sent to ${response.data.data.deliveredCount} recipients`);
      }
      setNotification((current) => ({ ...current, subject: '', message: '' }));
      setNotificationRecipientIds([]);
    }
    catch (error) { toast.error(error.response?.data?.message || 'Notification failed.'); }
  };

  return <Shell title="Placement Officer Dashboard" role="admin" onLogout={onLogout}>
    <div className="mb-6 flex flex-wrap gap-2">{[['overview','Overview'],['students','Students'],['placed','Placed Students'],['companies','Companies'],['drives','Drives'],['applications','Applications'],['notifications','Notifications']].map(([id,label]) => <button key={id} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border'}`} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'overview' && <><div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6"><StatCard label="Students" value={stats?.students ?? 0} /><StatCard label="Recruiters" value={stats?.recruiters ?? 0} tone="green" /><StatCard label="Companies" value={stats?.companies ?? 0} tone="amber" /><StatCard label="Drives" value={stats?.jobs ?? 0} /><StatCard label="Applications" value={stats?.applications ?? 0} tone="green" /><StatCard label="Placed" value={stats?.placed ?? 0} tone="amber" /></div><div className="mt-6 grid gap-6 lg:grid-cols-2"><div className="card"><h2 className="mb-4 text-lg font-bold">Pending company approvals</h2>{companies.filter((company) => company.status === 'pending').length ? companies.filter((company) => company.status === 'pending').slice(0,5).map((company) => <div className="flex items-center justify-between border-b py-3" key={company._id}><div><p className="font-medium">{company.name}</p><p className="text-xs text-gray-500">{company.industry}</p></div><button className="btn-primary py-1" onClick={() => setCompanyStatus(company._id,'active')}>Approve</button></div>) : <p className="text-sm text-gray-500">No pending companies.</p>}</div><div className="card"><h2 className="mb-4 text-lg font-bold">Pending drive approvals</h2>{jobs.filter((job) => job.approvalStatus === 'pending').length ? jobs.filter((job) => job.approvalStatus === 'pending').slice(0,5).map((job) => <div className="flex items-center justify-between border-b py-3" key={job._id}><div><p className="font-medium">{job.title}</p><p className="text-xs text-gray-500">{job.companyId?.name}</p></div><button className="btn-primary py-1" onClick={() => setJobApproval(job._id,'approved')}>Approve</button></div>) : <p className="text-sm text-gray-500">No pending drives.</p>}</div></div></>}
    {tab === 'students' && <div className="card overflow-x-auto"><h2 className="mb-4 text-xl font-bold">Students</h2><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Photo</th><th>Student Name</th><th>Roll no.</th><th>Email</th><th>Phone Number</th><th>Branch</th><th>CGPA</th><th>Passing Batch</th><th>Status</th><th>Action</th></tr></thead><tbody>{students.map((student) => <tr className="border-b" key={student._id}><td className="py-3"><StudentAvatar student={student} /></td><td className="py-3 font-medium">{student.fullName}</td><td>{student.rollNumber}</td><td>{student.userId?.email || '—'}</td><td>{student.phone || '—'}</td><td>{student.branch}</td><td>{student.cgpa}</td><td>{student.graduationYear || '—'}</td><td><StatusBadge status={student.placementStatus} /></td><td><button type="button" className="btn-secondary py-1 text-xs" onClick={() => setPlacementStudent(student)}>Change status</button></td></tr>)}</tbody></table></div>}
    {tab === 'placed' && <div className="card overflow-x-auto">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
        <div><h2 className="text-xl font-bold">Placed Students</h2><p className="text-sm text-gray-500">{placedStudents.length} verified placement records</p></div>
        <input className="input md:ml-auto md:max-w-xs" placeholder="Search name or roll number" value={placedFilters.search} onChange={(event) => setPlacedFilters({ ...placedFilters, search: event.target.value })} />
        <select className="input md:w-40" value={placedFilters.branch} onChange={(event) => setPlacedFilters({ ...placedFilters, branch: event.target.value })}><option value="">All branches</option>{['CSE','IT','ECE','EEE','ME','CE','Other'].map((branch) => <option key={branch}>{branch}</option>)}</select>
        <select className="input md:w-40" value={placedFilters.sort} onChange={(event) => setPlacedFilters({ ...placedFilters, sort: event.target.value })}><option value="date-desc">Latest</option><option value="date-asc">Oldest</option><option value="package-desc">Highest package</option><option value="package-asc">Lowest package</option></select>
      </div>
      <table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Student</th><th>Roll no.</th><th>Branch</th><th>Company</th><th>Role</th><th>Package</th><th>Confirmed</th></tr></thead><tbody>{placedStudents
        .filter((placement) => !placedFilters.search || `${placement.studentId?.fullName || ''} ${placement.studentId?.rollNumber || ''}`.toLowerCase().includes(placedFilters.search.toLowerCase()))
        .filter((placement) => !placedFilters.branch || placement.studentId?.branch === placedFilters.branch)
        .sort((a,b) => placedFilters.sort === 'package-desc' ? Number(b.package)-Number(a.package) : placedFilters.sort === 'package-asc' ? Number(a.package)-Number(b.package) : placedFilters.sort === 'date-asc' ? new Date(a.confirmedAt)-new Date(b.confirmedAt) : new Date(b.confirmedAt)-new Date(a.confirmedAt))
        .map((placement) => <tr className="border-b" key={placement._id}><td className="py-3 font-medium">{placement.studentId?.fullName || '—'}</td><td>{placement.studentId?.rollNumber || '—'}</td><td>{placement.studentId?.branch || '—'}</td><td>{placement.companyId?.name || '—'}</td><td>{placement.jobRole || placement.jobId?.title || 'Not Available'}</td><td>{placement.package ? `${placement.package} INR` : '—'}</td><td>{placement.confirmedAt ? new Date(placement.confirmedAt).toLocaleDateString() : '—'}</td></tr>)}</tbody></table>
    </div>}
    {tab === 'companies' && <div className="space-y-6"><div className="card overflow-x-auto"><h2 className="mb-4 text-xl font-bold">Companies</h2><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Company</th><th>Industry</th><th>Location</th><th>Status</th><th>Action</th></tr></thead><tbody>{companies.map((company) => <tr className="border-b" key={company._id}><td className="py-3 font-medium">{company.name}</td><td>{company.industry}</td><td>{company.location}</td><td><StatusBadge status={company.status} /></td><td><select className="input py-1" value={company.status} onChange={(event) => setCompanyStatus(company._id,event.target.value)}><option value="pending">Pending</option><option value="active">Active</option><option value="inactive">Inactive</option></select></td></tr>)}</tbody></table></div><div className="card"><h2 className="mb-4 text-xl font-bold">Recruiters</h2><div className="space-y-3">{recruiters.map((recruiter) => <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" key={recruiter._id}><div><p className="font-medium">{recruiter.fullName}</p><p className="text-xs text-gray-500">{recruiter.companyId?.name || 'No company'} · {recruiter.designation}</p></div><select className="input w-36 py-1" value={recruiter.approvalStatus} onChange={(event) => setRecruiterApproval(recruiter._id,event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>)}</div></div></div>}
    {tab === 'drives' && <div className="card overflow-x-auto"><h2 className="mb-4 text-xl font-bold">Placement drives</h2><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Drive</th><th>Company</th><th>Status</th><th>Action</th></tr></thead><tbody>{jobs.map((job) => <tr className="border-b" key={job._id}><td className="py-3 font-medium">{job.title}</td><td>{job.companyId?.name || '—'}</td><td><StatusBadge status={job.approvalStatus} /></td><td><select className="input w-32 py-1" value={job.approvalStatus} onChange={(event) => setJobApproval(job._id,event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></td></tr>)}</tbody></table></div>}
    {tab === 'applications' && <div className="card overflow-x-auto"><h2 className="mb-4 text-xl font-bold">All applications</h2><table className="min-w-full whitespace-nowrap text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3 pr-4">Student</th><th className="pr-4">Roll Number</th><th className="pr-4">Branch</th><th className="pr-4">Mobile Number</th><th className="pr-4">Drive</th><th className="pr-4">Company</th><th>Status</th></tr></thead><tbody>{applications.map((application) => <tr className="border-b" key={application._id}><td className="py-3 pr-4 font-medium">{application.studentId?.fullName || 'N/A'}</td><td className="pr-4">{application.studentId?.rollNumber || 'N/A'}</td><td className="pr-4">{application.studentId?.branch || 'N/A'}</td><td className="pr-4">{application.studentId?.phone || 'N/A'}</td><td className="pr-4">{application.jobId?.title || 'N/A'}</td><td className="pr-4">{application.companyId?.name || 'N/A'}</td><td><StatusBadge status={application.status} /></td></tr>)}</tbody></table></div>}
    {tab === 'notifications' && <form className="card max-w-2xl space-y-4" onSubmit={sendNotification}><h2 className="text-xl font-bold">Send Email Notification</h2><select className="input" value={notification.audience} onChange={(event) => { setNotification({ ...notification, audience: event.target.value }); setNotificationRecipientIds([]); }}><option value="students">All students</option><option value="recruiters">All recruiters</option><option value="individual-student">Individual student</option><option value="multiple-students">Multiple students</option><option value="individual-recruiter">Individual recruiter</option><option value="multiple-recruiters">Multiple recruiters</option></select>{notification.audience.includes('student') && notification.audience !== 'students' && <select className="input" multiple size="5" value={notificationRecipientIds} onChange={(event) => setNotificationRecipientIds([...event.target.selectedOptions].map((option) => option.value))}>{students.map((student) => <option key={student._id} value={student._id}>{student.fullName} · {student.rollNumber}</option>)}</select>}{notification.audience.includes('recruiter') && notification.audience !== 'recruiters' && <select className="input" multiple size="5" value={notificationRecipientIds} onChange={(event) => setNotificationRecipientIds([...event.target.selectedOptions].map((option) => option.value))}>{recruiters.map((recruiter) => <option key={recruiter._id} value={recruiter._id}>{recruiter.fullName}</option>)}</select>}<input className="input" placeholder="Subject" required value={notification.subject} onChange={(event) => setNotification({ ...notification, subject: event.target.value })} /><textarea className="input min-h-32" placeholder="Message" required value={notification.message} onChange={(event) => setNotification({ ...notification, message: event.target.value })} /><button className="btn-primary" type="submit">Preview & send</button></form>}
    <Modal open={Boolean(placementStudent)} title="Change placement status" onClose={() => setPlacementStudent(null)}>
      {placementStudent && <form className="space-y-4" onSubmit={updatePlacementStatus}>
        <div><p className="text-sm text-gray-500">Student</p><p className="font-semibold">{placementStudent.fullName} · {placementStudent.rollNumber}</p></div>
        <select className="input" name="placementStatus" defaultValue={placementStudent.placementStatus}>
          <option value="unplaced">Unplaced</option><option value="placed">Placed</option><option value="opted-out">Opted out</option><option value="higher-studies">Higher studies</option><option value="internship">Internship</option><option value="not-interested">Not interested</option><option value="in-progress">In progress</option>
        </select>
        <select className="input" name="companyId" defaultValue=""><option value="">Select company (required for placed)</option>{companies.map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}</select>
        <input className="input" name="jobRole" placeholder="Job role / designation" />
        <input className="input" name="package" type="number" min="0" placeholder="Package / stipend" />
        <textarea className="input min-h-24" name="placementDetails" placeholder="Placement details (role, offer, joining date, etc.)" />
        <textarea className="input min-h-20" name="reason" placeholder="Reason or admin note" />
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setPlacementStudent(null)} disabled={placementBusy}>Cancel</button><button type="submit" className="btn-primary" disabled={placementBusy}>{placementBusy ? 'Saving...' : 'Update status'}</button></div>
      </form>}
    </Modal>
  </Shell>;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { setChecking(false); return; }
    api.get('/auth/me')
      .then(({ data }) => setSession(data.data))
      .catch(() => localStorage.removeItem('accessToken'))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Loading...</div>;
  if (!session) return <Auth onAuthenticated={setSession} />;
  const logout = () => { localStorage.removeItem('accessToken'); setSession(null); toast.success('Signed out'); };
  if (session.user.role === 'admin') return <AdminDashboard onLogout={logout} />;
  if (session.user.role === 'recruiter') return <RecruiterDashboard session={session} onLogout={logout} />;
  return <StudentDashboard session={session} onLogout={logout} />;
}
