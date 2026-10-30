// Reads and validates the seed settings from the environment.
// The first SUPER_ADMIN always gets its credentials from ADMIN_EMAIL / ADMIN_PASSWORD
// (no hard-coded passwords). Demo users and sample data are only created when
// SEED_DEMO=true AND NODE_ENV is not "production".

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DEFAULT_DEMO_PASSWORD = 'Demo@12345';

function resolveSeedConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const demoRequested = String(env.SEED_DEMO || '').toLowerCase() === 'true';
  const email = String(env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(env.ADMIN_PASSWORD || '');

  const problems = [];
  if (!EMAIL_RE.test(email)) problems.push('ADMIN_EMAIL is missing or not a valid email address');
  if (password.length < 12) problems.push('ADMIN_PASSWORD is missing or shorter than 12 characters');
  if (/change[-_ ]?me|example|placeholder/i.test(password))
    problems.push('ADMIN_PASSWORD still looks like a placeholder (CHANGE_ME / change-me / example)');
  if (problems.length) {
    const error = new Error(
      `Seed aborted:\n  - ${problems.join('\n  - ')}\nSet them in .env (see .env.docker.example / server/.env.example).`
    );
    error.code = 'SEED_CONFIG';
    throw error;
  }

  const warnings = [];
  if (demoRequested && isProduction)
    warnings.push('SEED_DEMO=true is ignored because NODE_ENV=production (no demo users in production).');

  return {
    admin: { email, password },
    demo: demoRequested && !isProduction,
    demoPassword: String(env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD),
    warnings
  };
}

module.exports = { resolveSeedConfig, DEFAULT_DEMO_PASSWORD };
