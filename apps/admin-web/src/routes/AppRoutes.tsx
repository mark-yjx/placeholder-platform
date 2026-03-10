import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthCallbackPage } from '../pages/AuthCallbackPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { ProblemCreatePage } from '../pages/ProblemCreatePage';
import { ProblemEditPage } from '../pages/ProblemEditPage';
import { ProblemPreviewPage } from '../pages/ProblemPreviewPage';
import { ProblemTestsPage } from '../pages/ProblemTestsPage';
import { ProblemsListPage } from '../pages/ProblemsListPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SubmissionDetailPage } from '../pages/SubmissionDetailPage';
import { SubmissionsListPage } from '../pages/SubmissionsListPage';
import { TotpVerifyPage } from '../pages/TotpVerifyPage';
import { UserDetailPage } from '../pages/UserDetailPage';
import { UsersListPage } from '../pages/UsersListPage';
import { ProtectedRoute } from './ProtectedRoute';

function LoginRoute() {
  const { status } = useAuth();

  if (status === 'authenticated_admin') {
    return <Navigate to="/" replace />;
  }

  if (status === 'pending_tfa') {
    return <Navigate to="/verify-totp" replace />;
  }

  return <LoginPage />;
}

function TotpRoute() {
  const { status } = useAuth();

  if (status === 'authenticated_admin') {
    return <Navigate to="/" replace />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <TotpVerifyPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/verify-totp" element={<TotpRoute />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<ProblemsListPage />} />
        <Route path="/admin/overview" element={<DashboardPage />} />
        <Route path="/admin/problems" element={<ProblemsListPage />} />
        <Route path="/admin/problems/create" element={<ProblemCreatePage />} />
        <Route path="/admin/problems/:problemId" element={<ProblemEditPage />} />
        <Route path="/admin/problems/:problemId/preview" element={<ProblemPreviewPage />} />
        <Route path="/admin/problems/:problemId/tests" element={<ProblemTestsPage />} />
        <Route path="/admin/users" element={<UsersListPage />} />
        <Route path="/admin/users/:userId" element={<UserDetailPage />} />
        <Route path="/problems/:problemId" element={<ProblemEditPage />} />
        <Route path="/problems/:problemId/tests" element={<ProblemTestsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/submissions" element={<SubmissionsListPage />} />
        <Route path="/submissions/:submissionId" element={<SubmissionDetailPage />} />
      </Route>
    </Routes>
  );
}
