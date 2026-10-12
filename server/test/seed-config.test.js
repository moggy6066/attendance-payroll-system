const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSeedConfig } = require('../src/utils/seedConfig');

const good = { ADMIN_EMAIL: 'Owner@Example.com', ADMIN_PASSWORD: 'a-long-strong-password' };

test('requires ADMIN_EMAIL and ADMIN_PASSWORD', () => {
  assert.throws(() => resolveSeedConfig({}), /ADMIN_EMAIL[\s\S]*ADMIN_PASSWORD/);
});

test('rejects short or placeholder passwords', () => {
  assert.throws(() => resolveSeedConfig({ ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD: 'short' }), /12 characters/);
  assert.throws(() => resolveSeedConfig({ ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD: 'CHANGE_ME_please_now' }), /placeholder/);
});

test('normalizes the admin email', () => {
  assert.equal(resolveSeedConfig(good).admin.email, 'owner@example.com');
});

test('demo data is off by default', () => {
  assert.equal(resolveSeedConfig(good).demo, false);
});

test('demo data only outside production', () => {
  assert.equal(resolveSeedConfig({ ...good, SEED_DEMO: 'true', NODE_ENV: 'development' }).demo, true);
  const prod = resolveSeedConfig({ ...good, SEED_DEMO: 'true', NODE_ENV: 'production' });
  assert.equal(prod.demo, false);
  assert.equal(prod.warnings.length, 1);
});
