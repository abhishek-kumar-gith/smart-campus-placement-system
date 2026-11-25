import { Navigate } from 'react-router-dom';

function RoleRoute({ session, requiredRole, children }) {
  if (!session) return <Navigate to="/login" replace />;
  if (requiredRole && session.user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default RoleRoute;
