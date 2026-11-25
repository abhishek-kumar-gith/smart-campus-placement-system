import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, CheckCircle2, Download, ExternalLink, Upload } from 'lucide-react';
import DashboardShell from '../../components/common/DashboardShell';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import StudentAvatar from '../../components/student/StudentAvatar';
import OfferCenter from '../../components/OfferCenter';
import api from '../../services/api';
import { STUDENT_BRANCHES } from '../../constants/branches';

export default function StudentDashboard({ session, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [resume, setResume] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [offers, setOffers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tab, setTab] = useState('drives');
  const [jobFilters, setJobFilters] = useState({ search: '', branch: '', location: '', jobType: '', minCtc: '', page: 1 });
  const [jobsPagination, setJobsPagination] = useState({ page: 1, totalPages: 0 });
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [editing, setEditing] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [ineligibleModal, setIneligibleModal] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/students/profile'), api.get('/students/applications'), api.get('/resumes'), api.get('/interviews'), api.get('/placements'), api.get('/offers?page=1&pageSize=100'), api.get('/notifications?page=1&pageSize=50')])
      .then(([profileData, applicationsData, resumeData, interviewsData, placementsData, offersData, notificationsData]) => {
        setProfile(profileData.data.data);
        setApplications(applicationsData.data.data || []);
        setResume(resumeData.data.data);
        setInterviews(interviewsData.data.data || []);
        setPlacements(placementsData.data.data || []);
        setOffers(offersData.data.data?.records || []);
        setNotifications(notificationsData.data.data?.records || []);
      }).catch((error) => toast.error(error.response?.data?.message || 'Could not load dashboard data.'));
  }, []);

  useEffect(() => {
    let active = true;
    setJobsLoading(true);
    setJobsError('');
    const params = new URLSearchParams(
      Object.entries(jobFilters).filter(([, value]) => value !== ''),
    );
    const timer = window.setTimeout(() => api.get(`/jobs/browse?${params.toString()}`)
      .then(({ data }) => {
        if (!active) return;
        setJobs(data.data?.records || []);
        setJobsPagination(data.data?.pagination || { page: 1, totalPages: 0 });
      })
      .catch((error) => {
        if (active) {
          setJobsError(error.response?.data?.message || 'Could not load placement drives.');
          toast.error(error.response?.data?.message || 'Could not load placement drives.');
        }
      })
      .finally(() => { if (active) setJobsLoading(false); }), 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [jobFilters.search, jobFilters.branch, jobFilters.location, jobFilters.jobType, jobFilters.minCtc, jobFilters.page]);

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
      const snapshotFields = ['submittedAt', 'storedFileName', 'fileSize', 'originalFileName', 'resumeId'];
      const hasSnapshotValidationError = (response?.errors || []).some((item) => {
        const field = typeof item === 'string' ? item : `${item.field || ''} ${item.message || ''}`;
        return snapshotFields.some((name) => field.toLowerCase().includes(name.toLowerCase()));
      });
      if (hasSnapshotValidationError) {
        toast.error(response.message || 'Application resume snapshot is invalid.');
        return;
      }
      if (response?.success === false
        && error.response?.status === 422
        && job?.eligibility?.eligible === false
        && response.errors?.length) {
        setIneligibleModal({ reasons: response.errors });
      } else if (error.response?.status === 422 && response?.message === 'You are not eligible for this job.') {
        setIneligibleModal({ reasons: response.errors || ['You are not eligible for this job.'] });
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
    try {
      payload.projects = JSON.parse(String(payload.projects || '[]'));
      payload.internships = JSON.parse(String(payload.internships || '[]'));
      payload.certifications = JSON.parse(String(payload.certifications || '[]'));
      if (![payload.projects, payload.internships, payload.certifications].every(Array.isArray)) {
        throw new Error('Profile experience fields must be JSON arrays.');
      }
    } catch (error) {
      toast.error(error.message || 'Projects, internships, and certifications must be valid JSON arrays.');
      return;
    }
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

  const transferCurrentResume = async (download) => {
    if (!resume?._id) {
      toast.error('Upload a resume before viewing or downloading it.');
      return;
    }
    let viewerWindow = null;
    if (!download) {
      viewerWindow = window.open('about:blank', '_blank');
      if (!viewerWindow) {
        toast.error('The browser blocked the PDF viewer. Allow pop-ups and try again.');
        return;
      }
      viewerWindow.opener = null;
    }
    let objectUrl = null;
    try {
      const response = await api.get(`/resumes/${resume._id}/download`, { responseType: 'blob' });
      objectUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      if (download) {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = resume.fileName || 'resume.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } else {
        viewerWindow.location.replace(objectUrl);
        const cleanup = window.setInterval(() => {
          if (viewerWindow.closed) {
            window.clearInterval(cleanup);
            URL.revokeObjectURL(objectUrl);
          }
        }, 1000);
      }
    } catch (error) {
      viewerWindow?.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      let message = error.response?.data?.message || 'Resume file could not be opened.';
      if (error.response?.data instanceof Blob) {
        try {
          const details = JSON.parse(await error.response.data.text());
          message = details.message || message;
        } catch (_) {}
      }
      toast.error(message);
    }
  };

  const markNotificationRead = async (notification) => {
    try {
      await api.patch(`/notifications/${notification._id}/read`, {});
      setNotifications((current) => current.map((item) =>
        item._id === notification._id ? { ...item, isRead: true } : item));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Notification could not be updated.');
    }
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
  const filteredJobs = jobs;
  const pendingApplications = activeApplications.filter((application) => application.status === 'applied').length;
  const shortlistedApplications = activeApplications.filter((application) => application.status === 'shortlisted').length;
  const rejectedApplications = applications.filter((application) => application.status === 'rejected').length;
  const selectedApplications = applications.filter((application) => ['selected', 'placed'].includes(application.status)).length;
  return <DashboardShell title="Student Dashboard" role="student" onLogout={onLogout}>
    <div className="mb-6 flex flex-wrap gap-2">
      {[['overview','Overview'],['drives','Placement drives'],['applications','My applications'],['interviews','Interviews'],['offers','Offers'],['notifications','Notifications'],['placements','Placement history'],['profile','My profile']].map(([id,label]) => <button key={id} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border'}`} onClick={() => setTab(id)}>{label}{id === 'notifications' && notifications.some((item) => !item.isRead) ? ` (${notifications.filter((item) => !item.isRead).length})` : ''}</button>)}
    </div>
    {tab === 'overview' && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total applications" value={applications.length} />
      <StatCard label="Pending applications" value={pendingApplications} tone="amber" />
      <StatCard label="Shortlisted" value={shortlistedApplications} tone="green" />
      <StatCard label="Rejected" value={rejectedApplications} tone="slate" />
      <StatCard label="Selected / placed" value={selectedApplications} tone="green" />
      <StatCard label="Interviews scheduled" value={interviews.filter((interview) => interview.status === 'scheduled' || interview.status === 'rescheduled').length} />
      <StatCard label="Offers received" value={offers.length} tone="amber" />
      <StatCard label="Placement status" value={profile?.placementStatus || 'unplaced'} tone="green" />
    </div>}
    {tab === 'drives' && <>
      <div className="mb-5 grid gap-3 rounded-xl bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5">
        <input className="input lg:col-span-2" placeholder="Search jobs, companies, skills" value={jobFilters.search} onChange={(event) => setJobFilters({ ...jobFilters, search: event.target.value, page: 1 })} />
        <select className="input" value={jobFilters.branch} onChange={(event) => setJobFilters({ ...jobFilters, branch: event.target.value, page: 1 })}><option value="">All branches</option>{STUDENT_BRANCHES.filter((branch) => branch !== 'Other').map((branch) => <option key={branch}>{branch}</option>)}</select>
        <input className="input" placeholder="Location" value={jobFilters.location} onChange={(event) => setJobFilters({ ...jobFilters, location: event.target.value, page: 1 })} />
        <div className="flex gap-2"><select className="input min-w-0" value={jobFilters.jobType} onChange={(event) => setJobFilters({ ...jobFilters, jobType: event.target.value, page: 1 })}><option value="">All types</option><option>Full-time</option><option>Internship</option><option>Contract</option></select><input className="input min-w-0" type="number" min="0" placeholder="Min CTC" value={jobFilters.minCtc} onChange={(event) => setJobFilters({ ...jobFilters, minCtc: event.target.value, page: 1 })} /></div>
      </div>
      <div className="mb-4 grid gap-4 md:grid-cols-3"><StatCard label="Student" value={profile?.fullName || session.user?.email} /><StatCard label="Available drives" value={filteredJobs.length} tone="green" /><StatCard label="Applications" value={activeApplications.length} tone="amber" /></div>
      {jobsLoading ? <div className="card text-sm text-gray-500">Loading eligible placement drives...</div> : jobsError ? <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{jobsError}</div> : <div className="grid gap-4 lg:grid-cols-2">{filteredJobs.length ? filteredJobs.map((job) => <article className="card" key={job._id}>
        <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">{job.title}</h3><p className="text-sm text-gray-500">{job.companyId?.name || 'Company'} · {job.location}</p></div><div className="flex flex-col items-end gap-2"><StatusBadge status={job.jobType} />{job.eligibility && <span className={job.eligibility.eligible ? 'badge-green' : 'badge-red'}>{job.eligibility.eligible ? 'Eligible' : 'Not Eligible'}</span>}</div></div>
        <p className="mt-4 line-clamp-3 text-sm text-gray-600">{job.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">{job.requiredSkills?.map((skill) => <span className="badge-gray" key={skill}>{skill}</span>)}</div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-600"><p>Minimum CGPA: {job.minCgpa}</p><p>Vacancies: {job.vacancies}</p><p>Deadline: {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString() : '—'}</p><p>Package: {job.package?.max ? `${job.package.max} ${job.package.currency || 'INR'}` : 'Not specified'}</p></div>
        <button className="btn-primary mt-5" onClick={() => apply(job._id)} disabled={appliedJobIds.has(job._id)}> {appliedJobIds.has(job._id) ? 'Applied' : 'Apply now'}</button>
      </article>) : <div className="card text-sm text-gray-500">No drives match your filters.</div>}</div>}
      {jobsPagination.totalPages > 1 && <div className="mt-5 flex items-center justify-between text-sm"><span>Page {jobsPagination.page} of {jobsPagination.totalPages}</span><div className="flex gap-2"><button className="btn-secondary" disabled={jobsPagination.page <= 1} onClick={() => setJobFilters({ ...jobFilters, page: jobsPagination.page - 1 })}>Previous</button><button className="btn-secondary" disabled={jobsPagination.page >= jobsPagination.totalPages} onClick={() => setJobFilters({ ...jobFilters, page: jobsPagination.page + 1 })}>Next</button></div></div>}
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
    {tab === 'applications' && <div className="card overflow-x-auto"><h2 className="mb-4 text-xl font-bold">My applications</h2>{applications.length ? <table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Drive</th><th>Company</th><th>Status</th><th>Applied</th><th>Match / Snapshot</th><th>History / Action</th></tr></thead><tbody>{applications.map((application) => <tr className="border-b align-top" key={application._id}><td className="py-3 font-medium">{application.jobId?.title || '—'}</td><td>{application.companyId?.name || '—'}</td><td><StatusBadge status={application.status} /><p className="mt-1 text-xs">{application.eligibilityDetails?.passed === false ? application.eligibilityDetails.reasons?.join(', ') : 'Eligibility met'}</p></td><td>{application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : '—'}</td><td><p>{application.skillMatchScore ?? 0}% skill match</p><p className="mt-1 max-w-48 truncate text-xs text-gray-500">{application.submittedResumeSnapshot?.originalFileName || 'Resume snapshot unavailable'}</p></td><td><details><summary className="cursor-pointer text-primary-700">View history</summary><div className="min-w-40 py-2 text-xs">{(application.statusHistory || []).map((entry, index) => <p key={`${entry.status}-${index}`}>{entry.status} · {new Date(entry.timestamp).toLocaleString()}</p>)}</div></details>{['applied','shortlisted','interview'].includes(application.status) && <button type="button" className="btn-danger mt-2 py-1 text-xs" disabled={withdrawBusy} onClick={() => withdrawApplication(application)}>Withdraw</button>}</td></tr>)}</tbody></table> : <p className="text-gray-500">You have not applied to any drives yet.</p>}</div>}
    {tab === 'interviews' && <div className="card"><h2 className="mb-4 text-xl font-bold">Interview schedule</h2>{interviews.length ? <div className="space-y-3">{interviews.map((interview) => <div className="rounded-lg border p-4" key={interview._id}><div className="flex justify-between gap-3"><p className="font-medium">{interview.round} · {interview.jobId?.title || 'Interview'}</p><StatusBadge status={interview.status} /></div><p className="mt-2 text-sm text-gray-500">{new Date(interview.scheduledAt).toLocaleString()} · {interview.mode}{interview.venue ? ` · ${interview.venue}` : ''}</p>{interview.meetingLink && <a className="mt-2 inline-block text-sm text-primary-700" href={interview.meetingLink} target="_blank" rel="noreferrer">Join meeting</a>}</div>)}</div> : <p className="text-sm text-gray-500">No interviews scheduled.</p>}</div>}
    {tab === 'placements' && <div className="card"><h2 className="mb-4 text-xl font-bold">Placement history</h2>{placements.length ? placements.map((placement) => <div className="rounded-lg border p-4" key={placement._id}><p className="font-medium">{placement.jobRole || placement.jobId?.title || 'Not Available'}</p><p className="mt-1 text-sm text-gray-500">{placement.companyId?.name || 'Company Not Available'}</p><p className="mt-1 text-xs text-gray-500">{placement.jobLocation || 'Location Not Available'}{placement.package ? ` · ${placement.package} INR` : ''}</p><StatusBadge status="placed" /></div>) : <p className="text-sm text-gray-500">No placement record yet.</p>}</div>}
    {tab === 'profile' && <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="card">
        {editing ? <form onSubmit={saveProfile} className="space-y-4">
          <h2 className="text-xl font-bold">Edit profile</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" name="fullName" defaultValue={profile?.fullName || ''} placeholder="Full name" />
            <input className="input" name="phone" defaultValue={profile?.phone || ''} placeholder="Phone" />
            <select className="input" name="branch" defaultValue={profile?.branch || 'CSE'}><option value="" disabled>Select branch</option>{STUDENT_BRANCHES.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select>
            <input className="input" name="cgpa" type="number" step="0.01" min="0" max="10" defaultValue={profile?.cgpa || ''} placeholder="CGPA" />
            <input className="input" name="graduationYear" type="number" defaultValue={profile?.graduationYear || ''} placeholder="Graduation year" />
            <select className="input" name="currentSemester" defaultValue={profile?.currentSemester || ''}><option value="" disabled>Select semester</option>{[1,2,3,4,5,6,7,8].map((semester) => <option key={semester} value={semester}>Sem {semester}</option>)}</select>
            <input className="input" name="skills" defaultValue={(profile?.skills || []).join(', ')} placeholder="Skills (comma separated)" />
            <input className="input" name="backlogCount" type="number" defaultValue={profile?.backlogs?.count || 0} placeholder="Backlogs" />
            <input className="input" name="backlogDetails" defaultValue={profile?.backlogs?.details || ''} placeholder="Backlog details" />
          </div>
          <label className="block text-sm font-medium">Projects (JSON array)<textarea className="input mt-1 min-h-32 font-mono text-xs" name="projects" defaultValue={JSON.stringify(profile?.projects || [], null, 2)} /></label>
          <label className="block text-sm font-medium">Experience / internships (JSON array)<textarea className="input mt-1 min-h-32 font-mono text-xs" name="internships" defaultValue={JSON.stringify(profile?.internships || [], null, 2)} /></label>
          <label className="block text-sm font-medium">Certifications (JSON array)<textarea className="input mt-1 min-h-32 font-mono text-xs" name="certifications" defaultValue={JSON.stringify(profile?.certifications || [], null, 2)} /></label>
          <p className="text-xs text-gray-500">Keep these as JSON arrays using the existing project, internship, and certification fields.</p>
          <button className="btn-primary" type="submit">Save profile</button><button className="btn-secondary ml-2" type="button" onClick={() => setEditing(false)}>Cancel</button>
        </form> : <>
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">Placement profile</h2><button className="btn-secondary" onClick={() => setEditing(true)}>Edit profile</button></div>
          <div className="mb-5"><StudentAvatar student={profile} size="large" /></div>
          <dl className="grid gap-4 text-sm md:grid-cols-2"><div><dt className="text-gray-500">Name</dt><dd className="font-medium">{profile?.fullName || '—'}</dd></div><div><dt className="text-gray-500">Branch / Degree</dt><dd className="font-medium">{profile?.branch} / {profile?.degree}</dd></div><div><dt className="text-gray-500">CGPA</dt><dd className="font-medium">{profile?.cgpa}</dd></div><div><dt className="text-gray-500">Graduation year</dt><dd className="font-medium">{profile?.graduationYear}</dd></div><div><dt className="text-gray-500">Backlogs</dt><dd className="font-medium">{profile?.backlogs?.count ?? 0}</dd></div><div><dt className="text-gray-500">Placement status</dt><dd><StatusBadge status={profile?.placementStatus} /></dd></div></dl>
          <div className="mt-5 flex flex-wrap gap-2">{profile?.skills?.map((skill) => <span className="badge-gray" key={skill}>{skill}</span>)}</div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div><h3 className="font-semibold">Projects</h3>{profile?.projects?.length ? profile.projects.map((project) => <p className="mt-2 text-sm" key={project._id || project.title}>{project.title}</p>) : <p className="mt-2 text-sm text-gray-500">No projects listed.</p>}</div>
            <div><h3 className="font-semibold">Experience</h3>{profile?.internships?.length ? profile.internships.map((item, index) => <p className="mt-2 text-sm" key={item._id || index}>{item.role} · {item.company}</p>) : <p className="mt-2 text-sm text-gray-500">No experience listed.</p>}</div>
            <div><h3 className="font-semibold">Certifications</h3>{profile?.certifications?.length ? profile.certifications.map((item, index) => <p className="mt-2 text-sm" key={item._id || index}>{item.name}</p>) : <p className="mt-2 text-sm text-gray-500">No certifications listed.</p>}</div>
          </div>
        </>}
      </div>
      <div className="space-y-6">
        <div className="card"><h2 className="mb-4 text-xl font-bold">Profile Photo</h2>{profilePhotoPreview && <img className="mb-4 h-32 w-32 rounded-full object-cover" src={profilePhotoPreview} alt="Profile photo preview" />}<form onSubmit={uploadProfilePhoto} className="space-y-3"><label className="btn-secondary inline-flex cursor-pointer items-center gap-2"><Upload size={16} /> Choose image<input name="photo" className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={selectProfilePhoto} /></label><button className="btn-primary block" type="submit" disabled={profilePhotoBusy}>{profilePhotoBusy ? 'Uploading...' : 'Upload Profile Photo'}</button><p className="text-xs text-gray-500">JPEG, JPG, PNG, or WebP. Maximum 5 MB.</p></form></div>
        <div className="card"><h2 className="mb-4 text-xl font-bold">Resume</h2>{resume ? <><p className="break-all text-sm font-medium">{resume.fileName}</p><p className="mt-1 text-sm text-gray-500">Parsing: {resume.parsingStatus || 'unknown'} · ATS score: {resume.atsScore ?? '—'}</p><p className="mt-1 text-sm text-gray-500">{resume.extractedSkills?.join(', ') || 'No skills extracted'}</p><div className="mt-3 flex gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-1" onClick={() => transferCurrentResume(false)}><ExternalLink size={14} /> View</button><button type="button" className="btn-secondary inline-flex items-center gap-1" onClick={() => transferCurrentResume(true)}><Download size={14} /> Download</button></div></> : <p className="text-sm text-gray-500">No resume uploaded.</p>}<label className="btn-primary mt-5 inline-flex cursor-pointer items-center gap-2"><Upload size={16} /> {resume ? 'Replace PDF' : 'Upload PDF'}<input className="hidden" type="file" accept=".pdf,application/pdf" onChange={uploadResume} /></label></div>
      </div>
    </div>}
    {tab === 'offers' && <OfferCenter api={api} role="student" />}
    {tab === 'notifications' && <div className="card"><div className="mb-4 flex items-center gap-2"><Bell size={20} className="text-primary-700" /><h2 className="text-xl font-bold">Notifications</h2></div>{notifications.length ? <div className="divide-y">{notifications.map((notification) => <article key={notification._id} className={`flex flex-wrap items-start justify-between gap-3 py-4 ${notification.isRead ? '' : 'bg-blue-50/60'}`}><div><h3 className="font-semibold">{notification.subject}</h3><p className="mt-1 whitespace-pre-line text-sm text-gray-600">{notification.message}</p><p className="mt-2 text-xs text-gray-400">{new Date(notification.createdAt).toLocaleString()}</p></div>{!notification.isRead && <button type="button" className="btn-secondary inline-flex items-center gap-1 text-xs" onClick={() => markNotificationRead(notification)}><CheckCircle2 size={14} /> Mark read</button>}</article>)}</div> : <p className="py-8 text-center text-sm text-gray-500">No notifications yet.</p>}</div>}
  </DashboardShell>;
}
