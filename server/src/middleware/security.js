// HTTP hardening for the API: security headers (helmet) and brute-force protection on login.
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

// Number of reverse proxies in front of the API, so req.ip is the real client IP.
// Docker: nginx (frontend) = 1 (default). With the Caddy "https" profile: 2. Local dev: 0.
function parseTrustProxy(value) {
  if (value === undefined || value === '') return 1;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : value;
}

function applySecurity(app, env = process.env) {
  app.disable('x-powered-by');
  app.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use('/api', createApiLimiter(env));
}

// General per-IP request limit for the whole API (generous: normal use never hits it).
// Protects authenticated endpoints from scripted abuse. API_RATE_LIMIT = requests/minute.
function createApiLimiter(env = process.env) {
  const limit = Number(env.API_RATE_LIMIT) > 0 ? Number(env.API_RATE_LIMIT) : 300;
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
    message: { message: 'Too many requests. Please slow down.' }
  });
}

// Failed login attempts per client IP; successful logins do not count.
function createLoginLimiter(env = process.env) {
  const limit = Number(env.LOGIN_RATE_LIMIT) > 0 ? Number(env.LOGIN_RATE_LIMIT) : 10;
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { message: 'Too many failed login attempts. Try again in 15 minutes.' }
  });
}

module.exports = { applySecurity, createLoginLimiter, createApiLimiter, parseTrustProxy };
