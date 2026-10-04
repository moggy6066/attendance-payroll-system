const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_TIMEZONE = 'Africa/Cairo';
const { parseDay, formatDay } = require('../src/utils/date');
const {
  parseWeekendDays,
  parseHolidays,
  isWorkingDay,
  eachDay,
  markAbsencesForDay,
  runAbsenceJob,
  applyApprovedLeave
} = require('../src/services/absence');

// Small in-memory stand-in for the Prisma calls used by the absence service.
function fakePrisma({ settings = {}, employees = [], attendance = [], leaves = [] } = {}) {
  const db = {
    settings: Object.entries(settings).map(([key, value]) => ({ key, value })),
    employees,
    attendance: attendance.map((a, i) => ({ id: `a${i}`, ...a })),
    leaves
  };
  const sameDay = (a, b) => a.getTime() === b.getTime();
  return {
    db,
    setting: {
      findMany: async ({ where }) => db.settings.filter((s) => where.key.in.includes(s.key)),
      upsert: async ({ where, create }) => {
        if (!db.settings.find((s) => s.key === where.key)) db.settings.push({ key: create.key, value: create.value });
      }
    },
    employee: {
      findMany: async ({ where }) =>
        db.employees.filter((e) => where.status.in.includes(e.status) && e.hireDate <= where.hireDate.lte)
    },
    attendance: {
      findMany: async ({ where }) => db.attendance.filter((a) => sameDay(a.date, where.date)),
      findUnique: async ({ where }) =>
        db.attendance.find((a) => a.employeeId === where.employeeId_date.employeeId && sameDay(a.date, where.employeeId_date.date)) || null,
      create: async ({ data }) => {
        const row = { id: `a${db.attendance.length}`, ...data };
        db.attendance.push(row);
        return row;
      },
      createMany: async ({ data }) => {
        for (const d of data) {
          if (!db.attendance.find((a) => a.employeeId === d.employeeId && sameDay(a.date, d.date))) {
            db.attendance.push({ id: `a${db.attendance.length}`, ...d });
          }
        }
      },
      update: async ({ where, data }) => Object.assign(db.attendance.find((a) => a.id === where.id), data)
    },
    leaveRequest: {
      findMany: async ({ where }) =>
        db.leaves.filter(
          (l) => l.status === where.status && where.employeeId.in.includes(l.employeeId) && l.startDate <= where.startDate.lte && l.endDate >= where.endDate.gte
        )
    }
  };
}

const D = parseDay;
const calendar = (weekend = '5,6', holidays = '') => ({ weekend: parseWeekendDays(weekend), holidays: parseHolidays(holidays) });
const emp = (id, extra = {}) => ({ id, status: 'ACTIVE', hireDate: D('2026-01-01'), ...extra });

test('weekend and holiday parsing', () => {
  assert.deepEqual([...parseWeekendDays(undefined)], [5, 6]);
  assert.deepEqual([...parseWeekendDays('5')], [5]);
  assert.deepEqual([...parseWeekendDays('')], []);
  assert.deepEqual([...parseHolidays('2026-10-06, 2026-10-07 bad')], ['2026-10-06', '2026-10-07']);
});

test('isWorkingDay skips Friday/Saturday and holidays', () => {
  const cal = calendar('5,6', '2026-10-06');
  assert.equal(isWorkingDay(D('2026-10-02'), cal), false); // Friday
  assert.equal(isWorkingDay(D('2026-10-03'), cal), false); // Saturday
  assert.equal(isWorkingDay(D('2026-10-04'), cal), true); // Sunday
  assert.equal(isWorkingDay(D('2026-10-06'), cal), false); // holiday
});

test('eachDay is inclusive', () => {
  assert.deepEqual(eachDay(D('2026-10-01'), D('2026-10-03')).map(formatDay), ['2026-10-01', '2026-10-02', '2026-10-03']);
});

test('markAbsencesForDay: absent, on leave, already recorded, not hired yet, terminated', async () => {
  const day = D('2026-10-04');
  const prisma = fakePrisma({
    employees: [emp('present'), emp('missing'), emp('leave'), emp('new', { hireDate: D('2026-10-10') }), emp('gone', { status: 'TERMINATED' })],
    attendance: [{ employeeId: 'present', date: day, status: 'PRESENT' }],
    leaves: [{ employeeId: 'leave', status: 'APPROVED', startDate: D('2026-10-04'), endDate: D('2026-10-05') }]
  });
  const r = await markAbsencesForDay(prisma, day, calendar());
  assert.deepEqual({ absent: r.absent, onLeave: r.onLeave }, { absent: 1, onLeave: 1 });
  const status = Object.fromEntries(prisma.db.attendance.map((a) => [a.employeeId, a.status]));
  assert.deepEqual(status, { present: 'PRESENT', missing: 'ABSENT', leave: 'ON_LEAVE' });

  // running twice does not duplicate anything
  await markAbsencesForDay(prisma, day, calendar());
  assert.equal(prisma.db.attendance.length, 3);
});

test('markAbsencesForDay does nothing on a weekend', async () => {
  const prisma = fakePrisma({ employees: [emp('x')] });
  const r = await markAbsencesForDay(prisma, D('2026-10-02'), calendar());
  assert.equal(r.skipped, 'non-working day');
  assert.equal(prisma.db.attendance.length, 0);
});

test('runAbsenceJob: first run only starts tracking today (no backfill)', async () => {
  const prisma = fakePrisma({ employees: [emp('x')] });
  const r = await runAbsenceJob(prisma, { today: D('2026-10-04') });
  assert.equal(r.days.length, 0);
  assert.equal(prisma.db.settings.find((s) => s.key === 'absence_tracking_start').value, '2026-10-04');
});

test('runAbsenceJob: marks working days from tracking start to yesterday only', async () => {
  const prisma = fakePrisma({
    settings: { absence_tracking_start: '2026-09-29', weekend_days: '5,6' },
    employees: [emp('x')]
  });
  const r = await runAbsenceJob(prisma, { today: D('2026-10-04') });
  // 29 Sep (Tue) .. 3 Oct (Sat): Tue, Wed, Thu are working days
  assert.equal(r.absent, 3);
  assert.deepEqual(prisma.db.attendance.map((a) => formatDay(a.date)).sort(), ['2026-09-29', '2026-09-30', '2026-10-01']);
  assert.ok(!prisma.db.attendance.some((a) => formatDay(a.date) === '2026-10-04'), 'today must not be marked');
});

test('applyApprovedLeave: creates ON_LEAVE, converts ABSENT, keeps check-ins, skips weekend', async () => {
  const prisma = fakePrisma({
    employees: [emp('x')],
    attendance: [
      { employeeId: 'x', date: D('2026-10-04'), status: 'ABSENT' },
      { employeeId: 'x', date: D('2026-10-05'), status: 'PRESENT', checkIn: new Date() }
    ]
  });
  // Thu 1 Oct .. Mon 5 Oct  → Thu (create), Fri/Sat (weekend), Sun (convert), Mon (keep)
  const r = await applyApprovedLeave(prisma, { employeeId: 'x', startDate: D('2026-10-01'), endDate: D('2026-10-05') });
  assert.deepEqual(r, { created: 1, converted: 1 });
  const byDay = Object.fromEntries(prisma.db.attendance.map((a) => [formatDay(a.date), a.status]));
  assert.deepEqual(byDay, { '2026-10-01': 'ON_LEAVE', '2026-10-04': 'ON_LEAVE', '2026-10-05': 'PRESENT' });
});
