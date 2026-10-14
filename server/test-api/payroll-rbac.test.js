const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma, resetDb, createUser, startServer } = require('./helpers');

// Fixed past month so results never depend on today's date.
const MONTH = 3;
const YEAR = 2025;
const day = (d) => new Date(Date.UTC(YEAR, MONTH - 1, d));

let api;
let admin;
let alice;
let bob;
let tokens = {};

test.before(async () => {
  await resetDb();
  admin = await createUser({ role: 'ADMIN', email: 'admin@test.local' });
  // salary 22000 / 22 working days = daily rate 1000 (easy arithmetic)
  alice = await createUser({
    role: 'EMPLOYEE',
    email: 'alice@test.local',
    employee: { employeeNumber: 'E001', fullName: 'Alice', salary: 22000 }
  });
  bob = await createUser({
    role: 'EMPLOYEE',
    email: 'bob@test.local',
    employee: { employeeNumber: 'E002', fullName: 'Bob', salary: 11000 }
  });

  // Alice: 3 PRESENT, 2 LATE, 1 ABSENT in the month, plus 90 overtime minutes.
  // One record in the following month must be ignored.
  const rows = [
    [1, 'PRESENT', 30],
    [2, 'PRESENT', 60],
    [3, 'PRESENT', 0],
    [4, 'LATE', 0],
    [5, 'LATE', 0],
    [6, 'ABSENT', 0]
  ];
  for (const [d, status, ot] of rows) {
    await prisma.attendance.create({
      data: { employeeId: alice.employee.id, date: day(d), status, overtimeMinutes: ot }
    });
  }
  await prisma.attendance.create({
    data: { employeeId: alice.employee.id, date: new Date(Date.UTC(YEAR, MONTH, 1)), status: 'ABSENT' }
  });

  api = await startServer();
  tokens = {
    admin: await api.login('admin@test.local'),
    alice: await api.login('alice@test.local'),
    bob: await api.login('bob@test.local')
  };
});

test.after(async () => {
  if (api) await api.close();
  await prisma.$disconnect();
});

test('payroll: requires authentication', async () => {
  const r = await api.call('GET', '/payroll');
  assert.equal(r.status, 401);
});

test('payroll: employees cannot generate payroll', async () => {
  const r = await api.call('POST', '/payroll/generate', { token: tokens.alice, body: { month: MONTH, year: YEAR } });
  assert.equal(r.status, 403);
});

test('payroll: invalid month is rejected', async () => {
  const r = await api.call('POST', '/payroll/generate', { token: tokens.admin, body: { month: 13, year: YEAR } });
  assert.equal(r.status, 400);
});

test('payroll: admin generates correct amounts', async () => {
  const r = await api.call('POST', '/payroll/generate', { token: tokens.admin, body: { month: MONTH, year: YEAR } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.generated, 2);
  assert.equal(r.body.skipped, 0);

  const a = await prisma.payroll.findFirst({
    where: { employeeId: alice.employee.id, month: String(MONTH), year: YEAR }
  });
  assert.ok(a, 'payroll row for Alice');
  assert.equal(a.presentDays, 5); // PRESENT + LATE
  assert.equal(a.absentDays, 1);
  assert.equal(Number(a.basicSalary), 22000);
  assert.equal(Number(a.overtimeHours), 1.5);
  // 2 late days x 5% of 1000 + 1 absent day x 1000 = 1100
  assert.equal(Number(a.lateDeductions), 1100);
  assert.equal(Number(a.netSalary), 20900);
  assert.equal(a.paid, false);

  const b = await prisma.payroll.findFirst({
    where: { employeeId: bob.employee.id, month: String(MONTH), year: YEAR }
  });
  assert.equal(Number(b.netSalary), 11000); // no attendance records → no deductions
});

test('payroll: generating the same month again skips existing records', async () => {
  const r = await api.call('POST', '/payroll/generate', {
    token: tokens.admin,
    body: { month: String(MONTH), year: String(YEAR) }
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.generated, 0);
  assert.equal(r.body.skipped, 2);
  assert.equal(await prisma.payroll.count(), 2);
});

test('payroll: an employee sees only their own payroll', async () => {
  const r = await api.call('GET', '/payroll', { token: tokens.alice });
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].employeeId, alice.employee.id);

  // even when asking for someone else's records explicitly
  const r2 = await api.call('GET', `/payroll?employeeId=${bob.employee.id}`, { token: tokens.alice });
  assert.equal(r2.status, 200);
  assert.ok(r2.body.every((p) => p.employeeId === alice.employee.id));
});

test("payroll: an employee cannot open another employee's payroll by id", async () => {
  const bobPay = await prisma.payroll.findFirst({ where: { employeeId: bob.employee.id } });
  const r = await api.call('GET', `/payroll/${bobPay.id}`, { token: tokens.alice });
  assert.equal(r.status, 403);
  const own = await api.call('GET', `/payroll/${bobPay.id}`, { token: tokens.bob });
  assert.equal(own.status, 200);
});

test('payroll: only admins can mark payroll as paid', async () => {
  const pay = await prisma.payroll.findFirst({ where: { employeeId: alice.employee.id } });
  const denied = await api.call('PUT', `/payroll/${pay.id}/mark-paid`, { token: tokens.alice });
  assert.equal(denied.status, 403);
  assert.equal((await prisma.payroll.findUnique({ where: { id: pay.id } })).paid, false);

  const ok = await api.call('PUT', `/payroll/${pay.id}/mark-paid`, { token: tokens.admin });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.paid, true);
  assert.equal(await prisma.notification.count({ where: { employeeId: alice.employee.id } }), 1);
});

test('rbac: employees cannot list users or employees', async () => {
  assert.equal((await api.call('GET', '/users', { token: tokens.alice })).status, 403);
  assert.equal((await api.call('GET', '/employees', { token: tokens.alice })).status, 403);
  assert.equal((await api.call('GET', '/users', { token: tokens.admin })).status, 200);
  assert.equal((await api.call('GET', '/employees', { token: tokens.admin })).status, 200);
});

test('rbac: employees cannot change settings', async () => {
  const r = await api.call('PUT', '/settings', { token: tokens.alice, body: { work_start: '08:00' } });
  assert.equal(r.status, 403);
});

test('rbac: a forged token (wrong secret) is rejected', async () => {
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ userId: admin.user.id, role: 'SUPER_ADMIN' }, 'wrong-secret');
  assert.equal((await api.call('GET', '/users', { token: forged })).status, 401);
});
