import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import DepartmentsPage from './pages/DepartmentsPage';
import AttendancePage from './pages/AttendancePage';
import LeavePage from './pages/LeavePage';
import PayrollPage from './pages/PayrollPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ImportPage from './pages/ImportPage';
import ProfilePage from './pages/ProfilePage';
import QrDisplayPage from './pages/QrDisplayPage';
import ScanPage from './pages/ScanPage';
import Layout from './components/Layout';
import NotFoundPage from './pages/NotFoundPage';

function ProtectedRoute({ children, allow = ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'] }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* QR attendance: full-screen pages without the sidebar layout */}
      <Route
        path="/qr"
        element={
          <ProtectedRoute allow={['SUPER_ADMIN', 'ADMIN']}>
            <QrDisplayPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scan"
        element={
          <ProtectedRoute>
            <ScanPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route
                  path="/employees"
                  element={
                    <ProtectedRoute allow={['SUPER_ADMIN', 'ADMIN']}>
                      <EmployeesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/departments"
                  element={
                    <ProtectedRoute allow={['SUPER_ADMIN', 'ADMIN']}>
                      <DepartmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/leave" element={<LeavePage />} />
                <Route path="/payroll" element={<PayrollPage />} />
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute allow={['SUPER_ADMIN', 'ADMIN']}>
                      <UsersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/import"
                  element={
                    <ProtectedRoute allow={['SUPER_ADMIN', 'ADMIN']}>
                      <ImportPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute allow={['SUPER_ADMIN', 'ADMIN']}>
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute allow={['SUPER_ADMIN', 'ADMIN']}>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
