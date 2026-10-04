// Automatic absence marking and approved-leave → attendance sync.
//
// Rules
// - Only working days are processed: weekend days (setting `weekend_days`, JS day numbers
//   0=Sunday … 6=Saturday, default "5,6" = Friday + Saturday) and public holidays
//   (setting `holidays`, comma-separated YYYY-MM-DD) are skipped.
// - Only days strictly BEFORE today (Africa/Cairo by default) are marked, so nobody is marked
//   absent while the work day is still running.
// - Nothing earlier than `absence_tracking_start` is ever touched. On the first run that setting
//   is created with today's date, so deploying this on an existing database does NOT backfill
//   absences for the time before the system was in use.
// - An employee without an attendance record on a working day becomes ABSENT, or ON_LEAVE when an
//   APPROVED leave covers that day. Existing records are never overwritten by the job.
// - Approving a leave writes ON_LEAVE for each working day of the leave; days that already have a
//   check-in are left untouched, ABSENT days are converted to ON_LEAVE.

const { localDay, parseDay, formatDay } = require('../utils/date');

const DAY_MS = 86400000;
const DEFAULT_WEEKEND = '5,6';
const MAX_LOOKBACK_DAYS = 31;
const ACTIVE_STATUSES = ['ACTIVE', 'ON_LEAVE'];

function parseWeekendDays(value) {
  const raw = value === undefined || value === null ? DEFAULT_WEEKEND : String(value);
  return new Set(
    raw
      .split(',')
      .map((x) => x.trim())
      .filter((x) => /^[0-6]$/.test(x))
      .map(Number)
  );
}

function parseHolidays(value) {
  return new Set(
    String(value || '')
      .split(/[\s,]+/)
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
  );
}

function isWorkingDay(day, calendar) {
  return !calendar.weekend.has(day.getUTCDay()) && !calendar.holidays.has(formatDay(day));
}

function eachDay(start, end) {
  const days = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) days.push(new Date(t));
  return days;
}

async function loadCalendar(prisma) {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['weekend_days', 'holidays', 'absence_tracking_start'] } }
  });
  const get = (key) => rows.find((r) => r.key === key)?.value;
  return {
    weekend: parseWeekendDays(get('weekend_days')),
    holidays: parseHolidays(get('holidays')),
    trackingStart: get('absence_tracking_start') ? parseDay(get('absence_tracking_start')) : null
  };
}

async function ensureTrackingStart(prisma, calendar, today = localDay()) {
  if (calendar.trackingStart) return calendar.trackingStart;
  const value = formatDay(today);
  await prisma.setting.upsert({
    where: { key: 'absence_tracking_start' },
    update: {},
    create: { key: 'absence_tracking_start', value, description: 'First day the automatic absence job may mark' }
  });
  calendar.trackingStart = parseDay(value);
  return calendar.trackingStart;
}

// Marks ABSENT / ON_LEAVE for every active employee without a record on `day`.
async function markAbsencesForDay(prisma, day, calendar) {
  const date = formatDay(day);
  if (!isWorkingDay(day, calendar)) return { date, skipped: 'non-working day', absent: 0, onLeave: 0 };

  const employees = await prisma.employee.findMany({
    where: { status: { in: ACTIVE_STATUSES }, hireDate: { lte: new Date(day.getTime() + DAY_MS - 1) } },
    select: { id: true }
  });
  const recorded = new Set(
    (await prisma.attendance.findMany({ where: { date: day }, select: { employeeId: true } })).map((a) => a.employeeId)
  );
  const missing = employees.filter((e) => !recorded.has(e.id)).map((e) => e.id);
  if (!missing.length) return { date, absent: 0, onLeave: 0 };

  const leaves = await prisma.leaveRequest.findMany({
    where: { status: 'APPROVED', employeeId: { in: missing }, startDate: { lte: day }, endDate: { gte: day } },
    select: { employeeId: true }
  });
  const onLeave = new Set(leaves.map((l) => l.employeeId));

  const data = missing.map((employeeId) => ({
    employeeId,
    date: day,
    status: onLeave.has(employeeId) ? 'ON_LEAVE' : 'ABSENT',
    lateMinutes: 0,
    overtimeMinutes: 0,
    deviceInfo: 'auto-absence-job'
  }));
  await prisma.attendance.createMany({ data, skipDuplicates: true });

  const leaveCount = data.filter((d) => d.status === 'ON_LEAVE').length;
  return { date, absent: data.length - leaveCount, onLeave: leaveCount };
}

// Processes every working day from max(tracking start, today-31) up to yesterday.
async function runAbsenceJob(prisma, { today = localDay() } = {}) {
  const calendar = await loadCalendar(prisma);
  const trackingStart = await ensureTrackingStart(prisma, calendar, today);
  const yesterday = new Date(today.getTime() - DAY_MS);
  const lookback = new Date(today.getTime() - MAX_LOOKBACK_DAYS * DAY_MS);
  const from = trackingStart > lookback ? trackingStart : lookback;
  if (from > yesterday) return { from: formatDay(from), to: formatDay(yesterday), days: [], absent: 0, onLeave: 0 };

  const days = [];
  for (const day of eachDay(from, yesterday)) days.push(await markAbsencesForDay(prisma, day, calendar));
  return {
    from: formatDay(from),
    to: formatDay(yesterday),
    days,
    absent: days.reduce((a, d) => a + d.absent, 0),
    onLeave: days.reduce((a, d) => a + d.onLeave, 0)
  };
}

// Called when a leave is approved.
async function applyApprovedLeave(prisma, leave) {
  const calendar = await loadCalendar(prisma);
  let created = 0;
  let converted = 0;
  for (const day of eachDay(new Date(leave.startDate), new Date(leave.endDate))) {
    if (!isWorkingDay(day, calendar)) continue;
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: leave.employeeId, date: day } }
    });
    if (!existing) {
      await prisma.attendance.create({
        data: { employeeId: leave.employeeId, date: day, status: 'ON_LEAVE', lateMinutes: 0, overtimeMinutes: 0, deviceInfo: 'leave-approval' }
      });
      created += 1;
    } else if (existing.status === 'ABSENT') {
      await prisma.attendance.update({ where: { id: existing.id }, data: { status: 'ON_LEAVE', deviceInfo: 'leave-approval' } });
      converted += 1;
    }
  }
  return { created, converted };
}

// Starts the background scheduler (disable with ABSENCE_JOB=off).
function startAbsenceScheduler(prisma, { intervalMs = 60 * 60 * 1000, logger = console } = {}) {
  if (String(process.env.ABSENCE_JOB || '').toLowerCase() === 'off') {
    logger.log('[absence-job] disabled (ABSENCE_JOB=off)');
    return null;
  }
  const tick = async () => {
    try {
      const r = await runAbsenceJob(prisma);
      if (r.absent || r.onLeave) logger.log(`[absence-job] ${r.from}..${r.to}: ${r.absent} absent, ${r.onLeave} on leave`);
    } catch (error) {
      logger.error('[absence-job] failed:', error.message);
    }
  };
  setTimeout(tick, 5000).unref();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
}

module.exports = {
  DEFAULT_WEEKEND,
  parseWeekendDays,
  parseHolidays,
  isWorkingDay,
  eachDay,
  loadCalendar,
  markAbsencesForDay,
  runAbsenceJob,
  applyApprovedLeave,
  startAbsenceScheduler
};
