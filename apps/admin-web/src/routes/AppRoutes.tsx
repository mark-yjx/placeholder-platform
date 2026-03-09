import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { ProblemEditPage } from '../pages/ProblemEditPage';
import { ProblemsListPage } from '../pages/ProblemsListPage';
import { ProtectedRoute } from './ProtectedRoute';

function LoginRoute() {
  const { status } = useAuth();

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <LoginPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<ProblemsListPage />} />
        <Route path="/problems/:problemId" element={<ProblemEditPage />} />
      </Route>
    </Routes>
  );
}
