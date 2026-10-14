import { test, expect } from '@playwright/test';
import { loadUsers, login } from './fixtures.js';

const NEW_PASSWORD = `New-${Date.now()}-pass`;

test('a user with a temporary password must change it before using the app', async ({ page }) => {
  const { newcomer } = loadUsers();
  await login(page, newcomer.email, newcomer.password);

  // Lands on the profile page with the warning.
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText('يجب تغيير كلمة المرور المؤقتة.')).toBeVisible();

  // Any other page bounces back to /profile (API answers 403 PASSWORD_CHANGE_REQUIRED).
  await page.goto('/payroll');
  await expect(page).toHaveURL(/\/profile$/);

  // Mismatched confirmation is rejected on the client.
  const inputs = page.locator('form input[type="password"]');
  await inputs.nth(0).fill(newcomer.password);
  await inputs.nth(1).fill(NEW_PASSWORD);
  await inputs.nth(2).fill(`${NEW_PASSWORD}x`);
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('كلمتا المرور غير متطابقتين')).toBeVisible();

  // Correct change → dashboard, and other pages now work.
  await inputs.nth(2).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('navigation').getByRole('link', { name: 'الرواتب' }).click();
  await expect(page).toHaveURL(/\/payroll$/);

  // The old temporary password no longer works; the new one does.
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await login(page, newcomer.email, newcomer.password);
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await login(page, newcomer.email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);
});
