import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import CompleteRecruiterDashboard from './RecruiterDashboard';
import api from './services/api';
import RoleRoute from './routes/RoleRoute';
import AuthPage from './pages/AuthPage';
import StudentDashboard from './pages/student/StudentDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import {
  ReferencePublicPortal,
  ReferencePlacementDrives,
  ReferencePublicRecords,
} from './pages/PublicPages';

function SessionDashboard({ session, onLogout }) {
  if (session.user.role === 'admin') return <AdminDashboard onLogout={onLogout} />;
  if (session.user.role === 'recruiter') return <CompleteRecruiterDashboard session={session} onLogout={onLogout} />;
  return <StudentDashboard session={session} onLogout={onLogout} />;
}

export default function AppRouter() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const onNavigate = (event) => navigate(event.detail);
    window.addEventListener('dcrust:navigate', onNavigate);
    if (!localStorage.getItem('accessToken')) {
      setChecking(false);
      return () => window.removeEventListener('dcrust:navigate', onNavigate);
    }
    api.get('/auth/me')
      .then(({ data }) => setSession(data.data))
      .catch(() => localStorage.removeItem('accessToken'))
      .finally(() => setChecking(false));
    return () => window.removeEventListener('dcrust:navigate', onNavigate);
  }, [navigate]);

  if (checking) return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Loading...</div>;
  const logout = () => {
    localStorage.removeItem('accessToken');
    setSession(null);
    navigate('/');
    toast.success('Signed out');
  };
  const dashboard = <SessionDashboard session={session} onLogout={logout} />;
  return <Routes>
    <Route path="/" element={session ? dashboard : <ReferencePublicPortal />} />
    <Route path="/login" element={session ? <Navigate to="/" replace /> : <AuthPage onAuthenticated={setSession} />} />
    <Route path="/register" element={session ? <Navigate to="/" replace /> : <AuthPage onAuthenticated={setSession} />} />
    <Route path="/placement-records" element={<ReferencePublicRecords />} />
    <Route path="/placement-drives" element={<ReferencePlacementDrives />} />
    <Route path="/dashboard" element={<RoleRoute session={session}>{dashboard}</RoleRoute>} />
    <Route path="/student/*" element={<RoleRoute session={session} requiredRole="student">{dashboard}</RoleRoute>} />
    <Route path="/recruiter/*" element={<RoleRoute session={session} requiredRole="recruiter">{dashboard}</RoleRoute>} />
    <Route path="/admin/*" element={<RoleRoute session={session} requiredRole="admin">{dashboard}</RoleRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
