const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { applySecurity, createLoginLimiter, parseTrustProxy } = require('../src/middleware/security');

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

function makeApp(env) {
  const app = express();
  applySecurity(app, { TRUST_PROXY: '0' });
  app.use(express.json());
  app.post('/login', createLoginLimiter(env), (req, res) =>
    req.body.password === 'ok' ? res.json({ ok: true }) : res.status(401).json({ message: 'bad' })
  );
  return app;
}

const post = (url, password) =>
  fetch(`${url}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password })
  });

test('sets security headers and hides x-powered-by', async () => {
  await withServer(makeApp({}), async (url) => {
    const res = await post(url, 'ok');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('content-security-policy'));
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

test('blocks after LOGIN_RATE_LIMIT failed attempts', async () => {
  await withServer(makeApp({ LOGIN_RATE_LIMIT: '3' }), async (url) => {
    for (let i = 0; i < 3; i += 1) assert.equal((await post(url, 'wrong')).status, 401);
    const blocked = await post(url, 'wrong');
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).message, /Too many/);
  });
});

test('successful logins do not count toward the limit', async () => {
  await withServer(makeApp({ LOGIN_RATE_LIMIT: '2' }), async (url) => {
    for (let i = 0; i < 5; i += 1) assert.equal((await post(url, 'ok')).status, 200);
    assert.equal((await post(url, 'wrong')).status, 401);
  });
});

test('parseTrustProxy', () => {
  assert.equal(parseTrustProxy(undefined), 1);
  assert.equal(parseTrustProxy('2'), 2);
  assert.equal(parseTrustProxy('false'), false);
});

test('general API limiter returns 429 above API_RATE_LIMIT and skips /api/health', async () => {
  const app = express();
  applySecurity(app, { TRUST_PROXY: '0', API_RATE_LIMIT: '3' });
  app.get('/api/x', (req, res) => res.json({ ok: true }));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await fetch(`${base}/api/x`)).status);
    assert.deepEqual(codes, [200, 200, 200, 429]);
    for (let i = 0; i < 5; i++) assert.equal((await fetch(`${base}/api/health`)).status, 200);
  } finally {
    server.close();
  }
});
