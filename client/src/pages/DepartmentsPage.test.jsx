import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The axios client is replaced so the page talks to an in-memory fake API.
vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

const { default: api } = await import('../api/axios');
const { default: DepartmentsPage } = await import('./DepartmentsPage');

const departments = [
  {
    id: 'd1',
    name: 'الموارد البشرية',
    managerId: 'e1',
    manager: { id: 'e1', fullName: 'سارة أحمد' },
    employees: [{ id: 'e1' }, { id: 'e2' }],
    createdAt: '2026-10-01T10:00:00.000Z'
  },
  { id: 'd2', name: 'المالية', managerId: null, manager: null, employees: [], createdAt: '2026-10-02T10:00:00.000Z' }
];
const employees = [
  { id: 'e1', fullName: 'سارة أحمد', employeeNumber: 'EMP-1' },
  { id: 'e2', fullName: 'محمد علي', employeeNumber: 'EMP-2' }
];

function renderAs(role) {
  localStorage.setItem('role', role);
  return render(<DepartmentsPage />);
}

const rowFor = async (name) => (await screen.findByText(name)).closest('tr');

beforeEach(() => {
  api.get.mockImplementation((url) =>
    Promise.resolve({ data: url === '/departments' ? departments : url === '/employees' ? employees : [] })
  );
});

describe('DepartmentsPage', () => {
  it('lists departments with manager and employee count', async () => {
    renderAs('ADMIN');
    const row = await rowFor('الموارد البشرية');
    expect(within(row).getByText('سارة أحمد')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(within(await rowFor('المالية')).getByText('—')).toBeInTheDocument();
  });

  it('creates a department with a manager', async () => {
    api.post.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderAs('ADMIN');
    await screen.findByText('المالية');

    await user.click(screen.getByRole('button', { name: 'إضافة قسم' }));
    expect(screen.getByRole('heading', { name: 'إضافة قسم' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), '  تقنية المعلومات ');
    await user.selectOptions(screen.getByRole('combobox'), 'e2');
    await user.click(screen.getByRole('button', { name: 'حفظ' }));

    expect(api.post).toHaveBeenCalledWith('/departments', { name: 'تقنية المعلومات', managerId: 'e2' });
    expect(await screen.findByText('تم إضافة القسم')).toBeInTheDocument();
  });

  it('shows the API error inside the form instead of alert()', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'Department already exists' } } });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    renderAs('ADMIN');
    await screen.findByText('المالية');

    await user.click(screen.getByRole('button', { name: 'إضافة قسم' }));
    await user.type(screen.getByRole('textbox'), 'المالية');
    await user.click(screen.getByRole('button', { name: 'حفظ' }));

    expect(await screen.findByText('Department already exists')).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('edits an existing department', async () => {
    api.put.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderAs('ADMIN');
    const row = await rowFor('المالية');

    await user.click(within(row).getByRole('button', { name: 'تعديل' }));
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('المالية');
    await user.clear(input);
    await user.type(input, 'الحسابات');
    await user.click(screen.getByRole('button', { name: 'حفظ' }));

    expect(api.put).toHaveBeenCalledWith('/departments/d2', { name: 'الحسابات' });
    expect(await screen.findByText('تم حفظ التعديلات')).toBeInTheDocument();
  });

  it('hides delete from admins (API allows it for super admin only)', async () => {
    renderAs('ADMIN');
    await screen.findByText('المالية');
    expect(screen.queryByRole('button', { name: 'حذف' })).not.toBeInTheDocument();
  });

  it('lets a super admin delete an empty department and blocks one with employees', async () => {
    api.delete.mockResolvedValue({ data: {} });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAs('SUPER_ADMIN');

    expect(within(await rowFor('الموارد البشرية')).getByRole('button', { name: 'حذف' })).toBeDisabled();
    await user.click(within(await rowFor('المالية')).getByRole('button', { name: 'حذف' }));

    expect(api.delete).toHaveBeenCalledWith('/departments/d2');
    expect(await screen.findByText('تم حذف القسم')).toBeInTheDocument();
  });

  it('shows a delete failure as an in-page message', async () => {
    api.delete.mockRejectedValue({ response: { data: { message: 'Cannot delete department with employees' } } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAs('SUPER_ADMIN');

    await user.click(within(await rowFor('المالية')).getByRole('button', { name: 'حذف' }));
    expect(await screen.findByText('Cannot delete department with employees')).toBeInTheDocument();
  });
});
