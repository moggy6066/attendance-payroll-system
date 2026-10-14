import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from './Layout';

function renderLayout(role) {
  localStorage.setItem('token', 't');
  localStorage.setItem('role', role);
  localStorage.setItem('user', JSON.stringify({ username: 'sara', employee: { fullName: 'سارة' } }));
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route path="*" element={<Layout><div>content</div></Layout>} />
      </Routes>
    </MemoryRouter>
  );
}

const navLabels = () => within(screen.getByRole('navigation')).getAllByRole('link').map((a) => a.textContent);

describe('Layout', () => {
  it('shows only the allowed menu items to an employee', () => {
    renderLayout('EMPLOYEE');
    expect(navLabels()).toEqual(['لوحة التحكم', 'الحضور', 'الإجازات', 'الرواتب', 'الملف الشخصي']);
    expect(screen.getByText('موظف')).toBeInTheDocument();
    expect(screen.getByText('سارة')).toBeInTheDocument();
  });

  it('shows the full menu to an admin', () => {
    renderLayout('ADMIN');
    expect(navLabels()).toHaveLength(9);
    expect(navLabels()).toContain('الإعدادات');
  });

  it('marks the current page as active', () => {
    renderLayout('ADMIN');
    expect(screen.getByRole('link', { name: 'لوحة التحكم' })).toHaveClass('bg-blue-600');
  });

  it('logout clears the session and returns to login', async () => {
    const user = userEvent.setup();
    renderLayout('ADMIN');
    await user.click(screen.getByRole('button', { name: 'تسجيل الخروج' }));
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('role')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
