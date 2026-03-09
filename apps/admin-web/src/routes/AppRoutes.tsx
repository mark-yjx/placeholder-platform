import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { ProblemCreatePage } from '../pages/ProblemCreatePage';
import { ProblemEditPage } from '../pages/ProblemEditPage';
import { ProblemPreviewPage } from '../pages/ProblemPreviewPage';
import { ProblemTestsPage } from '../pages/ProblemTestsPage';
import { ProblemsListPage } from '../pages/ProblemsListPage';
import { SubmissionDetailPage } from '../pages/SubmissionDetailPage';
import { SubmissionsListPage } from '../pages/SubmissionsListPage';
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
        <Route path="/admin/problems" element={<ProblemsListPage />} />
        <Route path="/admin/problems/create" element={<ProblemCreatePage />} />
        <Route path="/admin/problems/:problemId" element={<ProblemEditPage />} />
        <Route path="/admin/problems/:problemId/preview" element={<ProblemPreviewPage />} />
        <Route path="/admin/problems/:problemId/tests" element={<ProblemTestsPage />} />
        <Route path="/problems/:problemId" element={<ProblemEditPage />} />
        <Route path="/problems/:problemId/tests" element={<ProblemTestsPage />} />
        <Route path="/submissions" element={<SubmissionsListPage />} />
        <Route path="/submissions/:submissionId" element={<SubmissionDetailPage />} />
      </Route>
    </Routes>
  );
}
