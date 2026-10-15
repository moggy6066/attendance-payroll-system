// Users created by global-setup.js. Passwords are random per run (written to a temp file).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const FIXTURE_FILE = join(tmpdir(), 'aps-e2e-users.json');
export const loadUsers = () => JSON.parse(readFileSync(FIXTURE_FILE, 'utf8'));

export async function login(page, email, password) {
  await page.goto('/login');
  await page.getByPlaceholder('example@company.com').fill(email);
  await page.getByPlaceholder('**********').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
}
