// Date helpers that are explicit about the business timezone.
// Attendance/leave dates are stored as Postgres DATE (@db.Date). Prisma sends a JS Date
// and Postgres keeps only the UTC calendar day, so every "day" value must be UTC midnight
// of the *local* calendar day — otherwise Cairo (UTC+2/+3) days are saved one day early.

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Africa/Cairo';

function partsInZone(date = new Date(), timeZone = APP_TIMEZONE) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute)
  };
}

// UTC-midnight Date that represents the local calendar day of `date`.
function localDay(date = new Date()) {
  const { year, month, day } = partsInZone(date);
  return new Date(Date.UTC(year, month - 1, day));
}

// Parse 'YYYY-MM-DD' (or an ISO datetime) into a UTC-midnight day value.
function parseDay(value) {
  if (!value) return null;
  if (value instanceof Date) return localDay(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return localDay(d);
}

// First and last day (inclusive) of a month as UTC-midnight values.
function monthRange(month, year) {
  const now = partsInZone();
  const m = Number(month) || now.month;
  const y = Number(year) || now.year;
  return {
    month: m,
    year: y,
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 0))
  };
}

// Minutes since local midnight in the business timezone.
function localMinutesOfDay(date = new Date()) {
  const { hour, minute } = partsInZone(date);
  return hour * 60 + minute;
}

// '08:30' -> 510
function hhmmToMinutes(value, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Inclusive count of calendar days between two day values.
function daysBetweenInclusive(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function formatDay(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : '';
}

module.exports = {
  APP_TIMEZONE,
  partsInZone,
  localDay,
  parseDay,
  monthRange,
  localMinutesOfDay,
  hhmmToMinutes,
  daysBetweenInclusive,
  formatDay
};
