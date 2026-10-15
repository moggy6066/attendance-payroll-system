import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

// Random per run so no credential-looking literal lives in the repo.
const PASSWORD = crypto.randomUUID();

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

async function fillAndSubmit(user) {
  await user.type(screen.getByPlaceholderText('example@company.com'), 'admin@test.local');
  await user.type(screen.getByPlaceholderText('**********'), PASSWORD);
  await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));
}

describe('LoginPage', () => {
  it('renders the login form', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'نظام الحضور والانصراف' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeEnabled();
  });

  it('sends the credentials to /auth/login', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'x' }) });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderLogin();
    await fillAndSubmit(user);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'admin@test.local', password: PASSWORD });
  });

  it('shows the server error and stores nothing when login fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'Invalid email or password' }) })
    );
    const user = userEvent.setup();
    renderLogin();
    await fillAndSubmit(user);

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeEnabled();
  });

  it('shows a generic error when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    const user = userEvent.setup();
    renderLogin();
    await fillAndSubmit(user);
    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
  });

  it('stores the token, role and user after a successful login', async () => {
    const body = { token: 'jwt-123', user: { id: 'u1', role: 'ADMIN', username: 'admin', forcePasswordChange: false } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
    const user = userEvent.setup();
    renderLogin();
    await fillAndSubmit(user);

    await vi.waitFor(() => expect(localStorage.getItem('token')).toBe('jwt-123'));
    expect(localStorage.getItem('role')).toBe('ADMIN');
    expect(JSON.parse(localStorage.getItem('user')).username).toBe('admin');
  });
});
