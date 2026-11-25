import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardShell from '../../components/common/DashboardShell';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import StudentAvatar from '../../components/student/StudentAvatar';
import OfferCenter from '../../components/OfferCenter';
import api from '../../services/api';

export default function AdminDashboard({ onLogout }) {
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
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [interviews, setInterviews] = useState([]);
  const [companySearch, setCompanySearch] = useState('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [jobApprovalFilter, setJobApprovalFilter] = useState('');
  const [companyDetails, setCompanyDetails] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [busyAction, setBusyAction] = useState(false);
  const [interviewModal, setInterviewModal] = useState(false);
  const [interviewBusy, setInterviewBusy] = useState(false);
  useEffect(() => {
    Promise.all([api.get('/admin/dashboard'), api.get('/admin/students'), api.get('/admin/companies'), api.get('/recruiters'), api.get('/admin/jobs'), api.get('/admin/applications'), api.get('/admin/placed-students'), api.get('/admin/analytics'), api.get('/interviews')])
      .then(([statsData, studentsData, companiesData, recruitersData, jobsData, applicationsData, placedData, analyticsData, interviewsData]) => {
        setStats(statsData.data.data); setStudents(studentsData.data.data || []); setCompanies(companiesData.data.data || []);
        setRecruiters(recruitersData.data.data || []); setJobs(jobsData.data.data || []); setApplications(applicationsData.data.data || []);
        setPlacedStudents(placedData.data.data || []);
        setAnalytics(analyticsData.data.data);
        setInterviews(interviewsData.data.data || []);
      }).catch((error) => {
        setAnalyticsError(error.response?.data?.message || 'Could not load dashboard analytics.');
        toast.error(error.response?.data?.message || 'Could not load admin data.');
      }).finally(() => setAnalyticsLoading(false));
  }, []);

  const setCompanyStatus = async (id, status) => {
    const label = status === 'active' ? 'approve' : status === 'inactive' ? 'reject' : 'mark pending';
    if (!window.confirm(`Confirm to ${label} this company?`)) return;
    setBusyAction(true);
    try {
      await api.patch(`/admin/companies/${id}/status`, { status, remarks: approvalRemarks });
      setCompanies((current) => current.map((item) => item._id === id ? { ...item, status } : item));
      setCompanyDetails(null);
      setApprovalRemarks('');
      toast.success(`Company marked ${status}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Company update failed.');
    } finally {
      setBusyAction(false);
    }
  };
  const setRecruiterApproval = async (id, approvalStatus) => {
    try { await api.patch(`/recruiters/${id}/approval`, { approvalStatus }); setRecruiters((current) => current.map((item) => item._id === id ? { ...item, approvalStatus } : item)); toast.success(`Recruiter marked ${approvalStatus}`); }
    catch (error) { toast.error(error.response?.data?.message || 'Recruiter update failed.'); }
  };
  const setJobApproval = async (id, approvalStatus) => {
    const label = approvalStatus === 'approved' ? 'approve' : 'reject';
    if (!window.confirm(`Confirm to ${label} this placement drive?`)) return;
    setBusyAction(true);
    try {
      await api.patch(`/admin/jobs/${id}/approval`, { approvalStatus, remarks: approvalRemarks });
      setJobs((current) => current.map((item) => item._id === id ? { ...item, approvalStatus, status: approvalStatus === 'approved' ? 'active' : 'closed', isPublished: approvalStatus === 'approved' } : item));
      setJobDetails(null);
      setApprovalRemarks('');
      toast.success(`Drive marked ${approvalStatus}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Drive update failed.');
    } finally {
      setBusyAction(false);
    }
  };

  const openCompanyDetails = async (company) => {
    try {
      const response = await api.get(`/admin/companies/${company._id}`);
      setCompanyDetails(response.data.data);
      setApprovalRemarks('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load company details.');
    }
  };

  const openJobDetails = async (job) => {
    try {
      const response = await api.get(`/admin/jobs/${job._id}`);
      setJobDetails(response.data.data);
      setApprovalRemarks('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load drive details.');
    }
  };

  const scheduleInterview = async (event) => {
    event.preventDefault();
    setInterviewBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api.post('/interviews', {
        applicationId: form.get('applicationId'),
        round: form.get('round'),
        mode: form.get('mode'),
        scheduledAt: new Date(form.get('scheduledAt')).toISOString(),
        venue: form.get('venue') || undefined,
        meetingLink: form.get('meetingLink') || undefined,
        instructions: form.get('instructions') || undefined,
      });
      const response = await api.get('/interviews');
      setInterviews(response.data.data || []);
      setInterviewModal(false);
      toast.success('Interview scheduled');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not schedule interview.');
    } finally {
      setInterviewBusy(false);
    }
  };

  const updateInterview = async (interview, status) => {
    let scheduledAt;
    if (status === 'rescheduled') {
      const value = window.prompt('Enter new interview date and time', interview.scheduledAt ? new Date(interview.scheduledAt).toISOString().slice(0,16) : '');
      if (!value) return;
      scheduledAt = new Date(value).toISOString();
    }
    if (!window.confirm(`Confirm to mark this interview ${status}?`)) return;
    setInterviewBusy(true);
    try {
      await api.patch(`/interviews/${interview._id}/status`, { status, scheduledAt });
      setInterviews((current) => current.map((item) => item._id === interview._id ? { ...item, status, ...(scheduledAt ? { scheduledAt } : {}) } : item));
      toast.success(`Interview marked ${status}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update interview.');
    } finally {
      setInterviewBusy(false);
    }
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

  return <DashboardShell title="Placement Officer Dashboard" role="admin" onLogout={onLogout}>
    <div className="mb-6 flex flex-wrap gap-2">{[['overview','Overview'],['analytics','Analytics'],['students','Students'],['placed','Placed Students'],['companies','Companies'],['drives','Drives'],['applications','Applications'],['interviews','Interview Schedules'],['offers','Offer Letters'],['notifications','Notifications']].map(([id,label]) => <button key={id} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border'}`} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'overview' && <><div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4"><StatCard label="Registered students" value={analytics?.summary?.totalStudents ?? stats?.students ?? 0} /><StatCard label="Eligible students" value={analytics?.summary?.eligibleStudents ?? 0} tone="green" /><StatCard label="Applications" value={analytics?.summary?.totalApplications ?? stats?.applications ?? 0} tone="amber" /><StatCard label="Shortlisted" value={analytics?.summary?.shortlistedStudents ?? 0} /><StatCard label="Placed students" value={analytics?.summary?.placedStudents ?? stats?.placed ?? 0} tone="green" /><StatCard label="Active companies" value={analytics?.summary?.activeCompanies ?? 0} tone="amber" /><StatCard label="Active drives" value={analytics?.summary?.activeDrives ?? stats?.activeDrives ?? 0} /><StatCard label="Placement percentage" value={`${analytics?.summary?.placementPercentage ?? stats?.placementPercentage ?? 0}%`} tone="green" /></div><div className="mt-6 grid gap-6 lg:grid-cols-2"><div className="card"><h2 className="mb-4 text-lg font-bold">Pending company approvals</h2>{companies.filter((company) => company.status === 'pending').length ? companies.filter((company) => company.status === 'pending').slice(0,5).map((company) => <div className="flex items-center justify-between border-b py-3" key={company._id}><div><p className="font-medium">{company.name}</p><p className="text-xs text-gray-500">{company.industry}</p></div><button className="btn-primary py-1" onClick={() => openCompanyDetails(company)}>View Details</button></div>) : <p className="text-sm text-gray-500">No pending companies.</p>}</div><div className="card"><h2 className="mb-4 text-lg font-bold">Pending drive approvals</h2>{jobs.filter((job) => job.approvalStatus === 'pending').length ? jobs.filter((job) => job.approvalStatus === 'pending').slice(0,5).map((job) => <div className="flex items-center justify-between border-b py-3" key={job._id}><div><p className="font-medium">{job.title}</p><p className="text-xs text-gray-500">{job.companyId?.name}</p></div><button className="btn-primary py-1" onClick={() => openJobDetails(job)}>View Details</button></div>) : <p className="text-sm text-gray-500">No pending drives.</p>}</div></div></>}
    {tab === 'analytics' && <div className="space-y-6">{analyticsLoading ? <div className="card text-sm text-gray-500">Loading placement analytics...</div> : analyticsError ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{analyticsError}</div> : analytics ? <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Placement percentage" value={`${analytics.summary.placementPercentage}%`} tone="green" />
        <StatCard label="Minimum package" value={analytics.packageStatistics ? `${analytics.packageStatistics.minimum} INR` : 'No data'} tone="amber" />
        <StatCard label="Average package" value={analytics.packageStatistics ? `${analytics.packageStatistics.average} INR` : 'No data'} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card"><h2 className="mb-4 text-lg font-bold">Branch-wise student distribution</h2>{analytics.branchDistribution.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.branchDistribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="branch" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#2563eb" /></BarChart></ResponsiveContainer></div> : <p className="text-sm text-gray-500">No student data available.</p>}</div>
        <div className="card"><h2 className="mb-4 text-lg font-bold">Branch-wise placements</h2>{analytics.branchPlacements.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.branchPlacements}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="branch" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#059669" /></BarChart></ResponsiveContainer></div> : <p className="text-sm text-gray-500">No placement data available.</p>}</div>
        <div className="card"><h2 className="mb-4 text-lg font-bold">Company-wise placements</h2>{analytics.companyPlacements.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.companyPlacements} dataKey="count" nameKey="company" outerRadius={100} label>{analytics.companyPlacements.map((_, index) => <Cell key={index} fill={['#2563eb','#059669','#d97706','#7c3aed','#dc2626'][index % 5]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div> : <p className="text-sm text-gray-500">No company placement data available.</p>}</div>
        <div className="card"><h2 className="mb-4 text-lg font-bold">Application status distribution</h2>{analytics.applicationStatuses.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.applicationStatuses} dataKey="count" nameKey="status" outerRadius={100} label>{analytics.applicationStatuses.map((_, index) => <Cell key={index} fill={['#2563eb','#059669','#d97706','#7c3aed','#dc2626','#64748b'][index % 6]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div> : <p className="text-sm text-gray-500">No application data available.</p>}</div>
      </div>
      <div className="card"><h2 className="mb-4 text-lg font-bold">Placement trend by year</h2>{analytics.placementTrends.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.placementTrends}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <p className="text-sm text-gray-500">No historical placement trend data.</p>}</div>
    </> : null}</div>}
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
    {tab === 'companies' && <div className="space-y-6"><div className="card overflow-x-auto"><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end"><h2 className="text-xl font-bold">Companies</h2><input className="input md:ml-auto md:max-w-xs" placeholder="Search company name" value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} /><select className="input md:w-40" value={companyStatusFilter} onChange={(event) => setCompanyStatusFilter(event.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Company</th><th>Industry</th><th>Location</th><th>Status</th><th>Action</th></tr></thead><tbody>{companies.filter((company) => (!companyStatusFilter || company.status === companyStatusFilter) && (!companySearch || company.name.toLowerCase().includes(companySearch.toLowerCase()))).map((company) => <tr className="border-b" key={company._id}><td className="py-3 font-medium">{company.name}</td><td>{company.industry}</td><td>{company.location}</td><td><StatusBadge status={company.status} /></td><td><button type="button" className="btn-secondary py-1 text-xs" onClick={() => openCompanyDetails(company)}>View Details</button></td></tr>)}</tbody></table>{!companies.length && <p className="py-6 text-sm text-gray-500">No companies available.</p>}</div><div className="card"><h2 className="mb-4 text-xl font-bold">Recruiters</h2><div className="space-y-3">{recruiters.map((recruiter) => <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" key={recruiter._id}><div><p className="font-medium">{recruiter.fullName}</p><p className="text-xs text-gray-500">{recruiter.companyId?.name || 'No company'} · {recruiter.designation}</p></div><StatusBadge status={recruiter.approvalStatus} /></div>)}</div></div></div>}
    {tab === 'drives' && <div className="card overflow-x-auto"><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end"><h2 className="text-xl font-bold">Placement drives</h2><input className="input md:ml-auto md:max-w-xs" placeholder="Search company or job title" value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} /><select className="input md:w-40" value={jobApprovalFilter} onChange={(event) => setJobApprovalFilter(event.target.value)}><option value="">All approvals</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="draft">Draft</option></select></div><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Drive</th><th>Company</th><th>Approval</th><th>Job status</th><th>Action</th></tr></thead><tbody>{jobs.filter((job) => (!jobApprovalFilter || job.approvalStatus === jobApprovalFilter) && (!jobSearch || `${job.title} ${job.companyId?.name || ''}`.toLowerCase().includes(jobSearch.toLowerCase()))).map((job) => <tr className="border-b" key={job._id}><td className="py-3 font-medium">{job.title}</td><td>{job.companyId?.name || '—'}</td><td><StatusBadge status={job.approvalStatus} /></td><td><StatusBadge status={job.status} /></td><td><button type="button" className="btn-secondary py-1 text-xs" onClick={() => openJobDetails(job)}>View Details</button></td></tr>)}</tbody></table>{!jobs.length && <p className="py-6 text-sm text-gray-500">No placement drives available.</p>}</div>}
    {tab === 'applications' && <div className="card overflow-x-auto"><h2 className="mb-4 text-xl font-bold">All applications</h2><table className="min-w-full whitespace-nowrap text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3 pr-4">Student</th><th className="pr-4">Roll Number</th><th className="pr-4">Branch</th><th className="pr-4">Mobile Number</th><th className="pr-4">Drive</th><th className="pr-4">Company</th><th>Status</th></tr></thead><tbody>{applications.map((application) => <tr className="border-b" key={application._id}><td className="py-3 pr-4 font-medium">{application.studentId?.fullName || 'N/A'}</td><td className="pr-4">{application.studentId?.rollNumber || 'N/A'}</td><td className="pr-4">{application.studentId?.branch || 'N/A'}</td><td className="pr-4">{application.studentId?.phone || 'N/A'}</td><td className="pr-4">{application.jobId?.title || 'N/A'}</td><td className="pr-4">{application.companyId?.name || 'N/A'}</td><td><StatusBadge status={application.status} /></td></tr>)}</tbody></table></div>}
    {tab === 'interviews' && <div className="card overflow-x-auto"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Interview schedules</h2><p className="text-sm text-gray-500">Multiple rounds are supported for an application.</p></div><button type="button" className="btn-primary" onClick={() => setInterviewModal(true)}>Schedule interview</button></div>{interviews.length ? <table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Student</th><th>Round</th><th>Job</th><th>Company</th><th>Schedule</th><th>Mode</th><th>Status</th><th>Action</th></tr></thead><tbody>{interviews.map((interview) => <tr className="border-b" key={interview._id}><td className="py-3 font-medium">{interview.studentId?.fullName || '—'}</td><td>{interview.round}</td><td>{interview.jobId?.title || '—'}</td><td>{interview.companyId?.name || '—'}</td><td>{interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleString() : '—'}</td><td>{interview.mode}</td><td><StatusBadge status={interview.status} /></td>    <td><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary py-1 text-xs" disabled={interviewBusy} onClick={() => updateInterview(interview, 'rescheduled')}>Reschedule</button><button type="button" className="btn-secondary py-1 text-xs" disabled={interviewBusy} onClick={() => updateInterview(interview, 'completed')}>Complete</button><button type="button" className="btn-danger py-1 text-xs" disabled={interviewBusy} onClick={() => updateInterview(interview, 'cancelled')}>Cancel</button></div></td></tr>)}</tbody></table> : <p className="py-6 text-sm text-gray-500">No interviews scheduled.</p>}</div>}
    {tab === 'offers' && <OfferCenter api={api} role="admin" applications={applications} />}
    {tab === 'notifications' && <form className="card max-w-2xl space-y-4" onSubmit={sendNotification}><h2 className="text-xl font-bold">Send Email Notification</h2><select className="input" value={notification.audience} onChange={(event) => { setNotification({ ...notification, audience: event.target.value }); setNotificationRecipientIds([]); }}><option value="students">All students</option><option value="recruiters">All recruiters</option><option value="individual-student">Individual student</option><option value="multiple-students">Multiple students</option><option value="individual-recruiter">Individual recruiter</option><option value="multiple-recruiters">Multiple recruiters</option></select>{notification.audience.includes('student') && notification.audience !== 'students' && <select className="input" multiple size="5" value={notificationRecipientIds} onChange={(event) => setNotificationRecipientIds([...event.target.selectedOptions].map((option) => option.value))}>{students.map((student) => <option key={student._id} value={student._id}>{student.fullName} · {student.rollNumber}</option>)}</select>}{notification.audience.includes('recruiter') && notification.audience !== 'recruiters' && <select className="input" multiple size="5" value={notificationRecipientIds} onChange={(event) => setNotificationRecipientIds([...event.target.selectedOptions].map((option) => option.value))}>{recruiters.map((recruiter) => <option key={recruiter._id} value={recruiter._id}>{recruiter.fullName}</option>)}</select>}<input className="input" placeholder="Subject" required value={notification.subject} onChange={(event) => setNotification({ ...notification, subject: event.target.value })} /><textarea className="input min-h-32" placeholder="Message" required value={notification.message} onChange={(event) => setNotification({ ...notification, message: event.target.value })} /><button className="btn-primary" type="submit">Preview & send</button></form>}
    <Modal open={Boolean(companyDetails)} title="Company details" onClose={() => setCompanyDetails(null)}>
      {companyDetails && <>
        <dl className="grid gap-4 text-sm md:grid-cols-2"><div><dt className="text-gray-500">Name</dt><dd className="font-medium">{companyDetails.company.name}</dd></div><div><dt className="text-gray-500">Status</dt><dd><StatusBadge status={companyDetails.company.status} /></dd></div><div><dt className="text-gray-500">Industry</dt><dd>{companyDetails.company.industry || '—'}</dd></div><div><dt className="text-gray-500">Location</dt><dd>{companyDetails.company.location || '—'}</dd></div><div><dt className="text-gray-500">Website</dt><dd>{companyDetails.company.website || '—'}</dd></div><div><dt className="text-gray-500">Contact</dt><dd>{companyDetails.company.contactNumber || '—'} · {companyDetails.company.hrEmail || '—'}</dd></div></dl>
        {companyDetails.company.description && <p className="mt-4 text-sm text-gray-600">{companyDetails.company.description}</p>}
        <div className="mt-5"><h3 className="font-semibold">Recruiters</h3>{companyDetails.recruiters.length ? <div className="mt-2 space-y-2">{companyDetails.recruiters.map((recruiter) => <div className="rounded-lg border p-3 text-sm" key={recruiter._id}><p className="font-medium">{recruiter.fullName} · {recruiter.designation}</p><p className="text-gray-500">{recruiter.userId?.email || '—'} · {recruiter.approvalStatus}</p></div>)}</div> : <p className="mt-2 text-sm text-gray-500">No recruiters linked.</p>}</div>
        <div className="mt-5"><h3 className="font-semibold">Approval history</h3>{companyDetails.company.approvalHistory?.length ? <div className="mt-2 space-y-2">{[...companyDetails.company.approvalHistory].reverse().map((entry, index) => <div className="rounded-lg border p-3 text-sm" key={`${entry.timestamp}-${index}`}><p><strong>{entry.action}</strong>: {entry.previousStatus} → {entry.newStatus}</p><p className="mt-1 text-gray-500">{entry.remarks || 'No remarks'} · {entry.changedByRole}{entry.timestamp ? ` · ${new Date(entry.timestamp).toLocaleString()}` : ''}</p></div>)}</div> : <p className="mt-2 text-sm text-gray-500">No approval history.</p>}</div>
        <textarea className="input mt-5 min-h-20" placeholder="Approval remarks" value={approvalRemarks} onChange={(event) => setApprovalRemarks(event.target.value)} />
        <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-danger" disabled={busyAction} onClick={() => setCompanyStatus(companyDetails.company._id, 'inactive')}>Reject</button><button type="button" className="btn-primary" disabled={busyAction} onClick={() => setCompanyStatus(companyDetails.company._id, 'active')}>Approve</button></div>
      </>}
    </Modal>
    <Modal open={Boolean(jobDetails)} title="Placement drive details" onClose={() => setJobDetails(null)}>
      {jobDetails && <>
        <dl className="grid gap-4 text-sm md:grid-cols-2"><div><dt className="text-gray-500">Job title</dt><dd className="font-medium">{jobDetails.title}</dd></div><div><dt className="text-gray-500">Company</dt><dd>{jobDetails.companyId?.name || '—'}</dd></div><div><dt className="text-gray-500">Location</dt><dd>{jobDetails.location || '—'}</dd></div><div><dt className="text-gray-500">Employment type</dt><dd>{jobDetails.jobType || '—'}</dd></div><div><dt className="text-gray-500">Minimum CGPA</dt><dd>{jobDetails.minCgpa ?? 0}</dd></div><div><dt className="text-gray-500">Maximum backlogs</dt><dd>{jobDetails.maxBacklogs ?? 0}</dd></div><div><dt className="text-gray-500">Graduation year</dt><dd>{jobDetails.targetGraduationYear || '—'}</dd></div><div><dt className="text-gray-500">Vacancies</dt><dd>{jobDetails.vacancies || '—'}</dd></div><div><dt className="text-gray-500">Publish date</dt><dd>{jobDetails.publishDate ? new Date(jobDetails.publishDate).toLocaleDateString() : '—'}</dd></div><div><dt className="text-gray-500">Application deadline</dt><dd>{jobDetails.applicationDeadline ? new Date(jobDetails.applicationDeadline).toLocaleString() : '—'}</dd></div></dl>
        <p className="mt-4 text-sm text-gray-600">{jobDetails.description}</p>
        <p className="mt-3 text-sm"><strong>Eligible branches:</strong> {(jobDetails.allowedBranches || []).join(', ') || '—'}</p>
        <p className="mt-2 text-sm"><strong>Required skills:</strong> {(jobDetails.requiredSkills || []).join(', ') || '—'}</p>
        <p className="mt-2 text-sm"><strong>Package:</strong> {jobDetails.package?.min || 0}–{jobDetails.package?.max || 0} {jobDetails.package?.currency || 'INR'}</p>
        <div className="mt-5"><h3 className="font-semibold">Approval history</h3>{jobDetails.approvalHistory?.length ? <div className="mt-2 space-y-2">{[...jobDetails.approvalHistory].reverse().map((entry, index) => <div className="rounded-lg border p-3 text-sm" key={`${entry.timestamp}-${index}`}><p><strong>{entry.action}</strong>: {entry.previousApprovalStatus} → {entry.newApprovalStatus}</p><p className="mt-1 text-gray-500">{entry.remarks || 'No remarks'} · {entry.changedByRole}{entry.timestamp ? ` · ${new Date(entry.timestamp).toLocaleString()}` : ''}</p></div>)}</div> : <p className="mt-2 text-sm text-gray-500">No approval history.</p>}</div>
        <textarea className="input mt-5 min-h-20" placeholder="Approval remarks" value={approvalRemarks} onChange={(event) => setApprovalRemarks(event.target.value)} />
        <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-danger" disabled={busyAction} onClick={() => setJobApproval(jobDetails._id, 'rejected')}>Reject</button><button type="button" className="btn-primary" disabled={busyAction} onClick={() => setJobApproval(jobDetails._id, 'approved')}>Approve</button></div>
      </>}
    </Modal>
    <Modal open={interviewModal} title="Schedule interview" onClose={() => setInterviewModal(false)}>
      <form className="space-y-4" onSubmit={scheduleInterview}><select className="input" name="applicationId" required><option value="">Select application</option>{applications.map((application) => <option key={application._id} value={application._id}>{application.studentId?.fullName || 'Student'} · {application.jobId?.title || 'Job'}</option>)}</select><input className="input" name="round" placeholder="Round name (e.g. Technical)" minLength="2" required /><select className="input" name="mode" defaultValue="Online"><option>Online</option><option>On-campus</option><option>Offline</option></select><input className="input" name="scheduledAt" type="datetime-local" required /><input className="input" name="venue" placeholder="Venue (optional)" /><input className="input" name="meetingLink" placeholder="Meeting link (optional)" /><textarea className="input min-h-24" name="instructions" placeholder="Instructions" /><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setInterviewModal(false)} disabled={interviewBusy}>Cancel</button><button type="submit" className="btn-primary" disabled={interviewBusy}>{interviewBusy ? 'Scheduling...' : 'Schedule interview'}</button></div></form>
    </Modal>
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
  </DashboardShell>;
}
