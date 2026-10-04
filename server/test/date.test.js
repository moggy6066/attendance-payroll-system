const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_TIMEZONE = 'Africa/Cairo';
const { localDay, parseDay, monthRange, daysBetweenInclusive, formatDay, hhmmToMinutes, localMinutesOfDay } = require('../src/utils/date');

test('localDay uses the Cairo calendar day, not the UTC day', () => {
  // 2026-10-03 22:30 UTC is already 2026-10-04 01:30 in Cairo (UTC+3)
  assert.equal(formatDay(localDay(new Date('2026-10-03T22:30:00Z'))), '2026-10-04');
  // 2026-10-04 20:00 UTC is 23:00 the same day in Cairo
  assert.equal(formatDay(localDay(new Date('2026-10-04T20:00:00Z'))), '2026-10-04');
});

test('localDay returns UTC midnight (safe for @db.Date columns)', () => {
  const d = localDay(new Date('2026-10-03T22:30:00Z'));
  assert.equal(d.toISOString(), '2026-10-04T00:00:00.000Z');
});

test('parseDay accepts YYYY-MM-DD without shifting', () => {
  assert.equal(parseDay('2026-10-20').toISOString(), '2026-10-20T00:00:00.000Z');
  assert.equal(parseDay('not-a-date'), null);
  assert.equal(parseDay(''), null);
});

test('monthRange returns inclusive first/last day', () => {
  const r = monthRange(2, 2028); // leap year
  assert.equal(formatDay(r.start), '2028-02-01');
  assert.equal(formatDay(r.end), '2028-02-29');
  assert.equal(monthRange('10', '2026').month, 10);
});

test('daysBetweenInclusive', () => {
  assert.equal(daysBetweenInclusive(parseDay('2026-10-20'), parseDay('2026-10-22')), 3);
  assert.equal(daysBetweenInclusive(parseDay('2026-10-20'), parseDay('2026-10-20')), 1);
});

test('hhmmToMinutes and localMinutesOfDay', () => {
  assert.equal(hhmmToMinutes('08:30', 0), 510);
  assert.equal(hhmmToMinutes('bad', 480), 480);
  // 05:15 UTC = 08:15 Cairo (summer time, UTC+3)
  assert.equal(localMinutesOfDay(new Date('2026-10-04T05:15:00Z')), 8 * 60 + 15);
});
