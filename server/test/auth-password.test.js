const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { generateTempPassword } = require('../src/utils/password');
const { verifyToken } = require('../src/middleware/auth');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests-only';

test('temporary passwords are long, URL-safe and unique', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const p = generateTempPassword();
    assert.equal(p.length, 16);
    assert.match(p, /^[A-Za-z0-9_-]+$/);
    seen.add(p);
  }
  assert.equal(seen.size, 200);
});

function run(method, url, claims) {
  const token = jwt.sign({ userId: 'u1', role: 'EMPLOYEE', ...claims }, process.env.JWT_SECRET);
  const req = { method, originalUrl: url, headers: { authorization: `Bearer ${token}` } };
  const out = { status: 200, body: null, nextCalled: false };
  const res = {
    status(c) {
      out.status = c;
      return this;
    },
    json(b) {
      out.body = b;
      return this;
    }
  };
  verifyToken(req, res, () => {
    out.nextCalled = true;
  });
  return out;
}

test('pending password change blocks other endpoints with 403', () => {
  const r = run('GET', '/api/attendance', { pwc: true });
  assert.equal(r.nextCalled, false);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'PASSWORD_CHANGE_REQUIRED');
});

test('pending password change still allows profile and password endpoints', () => {
  assert.equal(run('GET', '/api/users/me', { pwc: true }).nextCalled, true);
  assert.equal(run('PUT', '/api/users/me/password', { pwc: true }).nextCalled, true);
  assert.equal(run('DELETE', '/api/users/me', { pwc: true }).nextCalled, false);
});

test('tokens without the flag (including tokens issued before this change) work as before', () => {
  assert.equal(run('GET', '/api/attendance', {}).nextCalled, true);
  assert.equal(run('GET', '/api/attendance', { pwc: false }).nextCalled, true);
});

test('missing or invalid token is 401', () => {
  const res = {
    s: 0,
    status(c) {
      this.s = c;
      return this;
    },
    json() {
      return this;
    }
  };
  verifyToken({ method: 'GET', originalUrl: '/api/x', headers: { authorization: 'Bearer nope' } }, res, () => {});
  assert.equal(res.s, 401);
});
