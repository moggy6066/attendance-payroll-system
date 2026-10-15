import { describe, it, expect } from 'vitest';
import api from './axios';

// Run requests through the interceptors with a fake adapter (no network).
function respond(status, data = {}) {
  return (config) =>
    status < 400
      ? Promise.resolve({ status, data, headers: {}, config })
      : Promise.reject(Object.assign(new Error(`HTTP ${status}`), { config, response: { status, data } }));
}

describe('api client', () => {
  it('adds the bearer token to requests', async () => {
    localStorage.setItem('token', 'abc');
    let seen;
    await api.get('/x', {
      adapter: (config) => {
        seen = config.headers.Authorization;
        return respond(200)(config);
      }
    });
    expect(seen).toBe('Bearer abc');
  });

  it('sends no Authorization header without a token', async () => {
    let seen = 'unset';
    await api.get('/x', {
      adapter: (config) => {
        seen = config.headers.Authorization;
        return respond(200)(config);
      }
    });
    expect(seen).toBeUndefined();
  });

  it('clears the session on 401', async () => {
    localStorage.setItem('token', 'old');
    localStorage.setItem('role', 'ADMIN');
    localStorage.setItem('user', '{}');
    await expect(api.get('/users', { adapter: respond(401) })).rejects.toThrow();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('role')).toBeNull();
  });

  it('keeps the session when the login request itself returns 401', async () => {
    localStorage.setItem('token', 'keep');
    await expect(api.post('/auth/login', {}, { adapter: respond(401) })).rejects.toThrow();
    expect(localStorage.getItem('token')).toBe('keep');
  });
});
