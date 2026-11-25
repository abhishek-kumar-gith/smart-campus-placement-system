import { useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft } from 'lucide-react';
import { BRANDING } from '../branding';
import api from '../services/api';
import { STUDENT_BRANCHES } from '../constants/branches';

function goPublic(path) {
  window.dispatchEvent(new CustomEvent('dcrust:navigate', { detail: path }));
}

const emptyLogin = { email: '', password: '' };
const emptyStudent = { email: '', password: '', fullName: '', rollNumber: '', phone: '', branch: 'CSE', degree: 'B.Tech', currentSemester: '', cgpa: '', graduationYear: new Date().getFullYear() + 1 };
const emptyRecruiter = { email: '', password: '', fullName: '', designation: '', phone: '', companyName: '', industry: '', location: '', hrName: '', hrEmail: '', contactNumber: '' };

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState(window.location.pathname === '/register' ? 'register' : 'login');
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
      <button type="button" className="mb-6 flex items-center gap-1 text-sm font-medium text-primary-700" onClick={() => goPublic('/')}><ChevronLeft size={16} /> Back to portal</button>
      <div className="mb-7 text-center">
        <img
          src={BRANDING.logoPath}
          alt={`${BRANDING.shortUniversityName} university logo`}
          className="mx-auto mb-3 h-16 w-16 rounded-xl object-contain"
        />
        <h1 className="text-2xl font-bold text-gray-900">{BRANDING.appName}</h1>
        <p className="mt-1 text-sm text-gray-500">{BRANDING.description}</p>
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
