import { test, expect } from '@playwright/test';
import { loadUsers, login } from './fixtures.js';

let users;
test.beforeAll(() => {
  users = loadUsers();
});

test('wrong password shows an error and stays on /login', async ({ page }) => {
  await login(page, users.admin.email, 'definitely-wrong');
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('protected pages redirect to /login without a session', async ({ page }) => {
  await page.goto('/payroll');
  await expect(page).toHaveURL(/\/login$/);
});

test('admin logs in, navigates the menu and logs out', async ({ page }) => {
  await login(page, users.admin.email, users.admin.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  const nav = page.getByRole('navigation');
  for (const [label, path, heading] of [
    ['الموظفين', '/employees', 'إدارة الموظفين'],
    ['الرواتب', '/payroll', 'الرواتب'],
    ['الإعدادات', '/settings', 'الإعدادات'],
    ['الملف الشخصي', '/profile', 'الملف الشخصي']
  ]) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: heading }).first()).toBeVisible();
  }

  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('employee sees a limited menu and cannot open admin pages', async ({ page }) => {
  await login(page, users.employee.email, users.employee.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  const nav = page.getByRole('navigation');
  await expect(nav.getByRole('link', { name: 'الرواتب' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'الموظفين' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'الإعدادات' })).toHaveCount(0);

  await page.goto('/employees');
  await expect(page).toHaveURL(/\/dashboard$/);
});
