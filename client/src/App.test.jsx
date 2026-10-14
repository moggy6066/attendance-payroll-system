import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Pages are replaced by stubs: these tests cover routing and role guards only.
vi.mock('./pages/DashboardPage', () => ({ default: () => <div>صفحة لوحة التحكم</div> }));
vi.mock('./pages/EmployeesPage', () => ({ default: () => <div>صفحة الموظفين</div> }));
vi.mock('./pages/PayrollPage', () => ({ default: () => <div>صفحة الرواتب</div> }));
vi.mock('./pages/SettingsPage', () => ({ default: () => <div>صفحة الإعدادات</div> }));
vi.mock('./pages/ProfilePage', () => ({ default: () => <div>صفحة الملف الشخصي</div> }));

const { default: App } = await import('./App');

function renderAt(path, { role } = {}) {
  if (role) {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('role', role);
    localStorage.setItem('user', JSON.stringify({ username: 'tester' }));
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe('App routing', () => {
  it('sends visitors without a token to the login page', () => {
    renderAt('/payroll');
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeInTheDocument();
  });

  it('redirects / to the dashboard for a logged-in user', () => {
    renderAt('/', { role: 'EMPLOYEE' });
    expect(screen.getByText('صفحة لوحة التحكم')).toBeInTheDocument();
  });

  it('lets an employee open pages allowed for every role', () => {
    renderAt('/payroll', { role: 'EMPLOYEE' });
    expect(screen.getByText('صفحة الرواتب')).toBeInTheDocument();
  });

  it.each(['/employees', '/settings', '/users', '/reports'])(
    'redirects an employee away from admin page %s',
    (path) => {
      renderAt(path, { role: 'EMPLOYEE' });
      expect(screen.getByText('صفحة لوحة التحكم')).toBeInTheDocument();
    }
  );

  it('lets an admin open admin pages', () => {
    renderAt('/employees', { role: 'ADMIN' });
    expect(screen.getByText('صفحة الموظفين')).toBeInTheDocument();
  });

  it('shows 404 for unknown paths', () => {
    renderAt('/does-not-exist', { role: 'ADMIN' });
    expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument();
  });
});
