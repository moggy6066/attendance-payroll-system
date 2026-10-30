const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { prisma, resetDb, createUser, startServer } = require('./helpers');

// FAKE data only. Fixed past month so results never depend on today's date.
const MONTH = 3;
const YEAR = 2025;
let api;
let adminToken;
let empToken;

async function workbook() {
  const wb = new ExcelJS.Workbook();
  const att = wb.addWorksheet('Employee Attendance');
  att.addRow([
    'كود الموظف',
    'الموظف',
    'الوظيفة',
    'عدد أيام العمل',
    'الراتب الأساسي',
    'قيمة الاجر اليومي',
    '01-Mar السبت',
    '02-Mar الأحد',
    '03-Mar الاثنين'
  ]);
  att.addRow(['901', 'موظف تجريبي', 'اخصائية', 8, '4000', '500', 'ح', 'م', 'غ']);
  const adv = wb.addWorksheet('Employee Advances');
  adv.addRow(['الموظفين', '2025-03-01', '2025-03-02', '2025-03-03', 'الخصومات']);
  adv.addRow(['موظف تجريبي', 0, 200, 0, 100]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function post(path, token, body) {
  const res = await fetch(`${api.base}${path}?month=${MONTH}&year=${YEAR}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body
  });
  return { status: res.status, body: await res.json() };
}

test.before(async () => {
  await resetDb();
  await createUser({ role: 'ADMIN', email: 'admin@test.local' });
  await createUser({
    role: 'EMPLOYEE',
    email: 'emp@test.local',
    employee: { employeeNumber: 'E001', fullName: 'Emp', salary: 1000 }
  });
  api = await startServer();
  api.base = `http://127.0.0.1:${api.server.address().port}/api`;
  adminToken = await api.login('admin@test.local');
  empToken = await api.login('emp@test.local');
});

test.after(async () => {
  await api.close();
  await prisma.$disconnect();
});

test('only admins can import', async () => {
  const file = await workbook();
  assert.equal((await post('/import/preview', empToken, file)).status, 403);
  assert.equal((await post('/import/preview', undefined, file)).status, 401);
});

test('preview saves nothing and rejects an unreadable file', async () => {
  const p = await post('/import/preview', adminToken, await workbook());
  assert.equal(p.status, 200);
  assert.equal(p.body.summary.employees, 1);
  assert.equal(await prisma.employee.count({ where: { employeeNumber: '901' } }), 0);
  const bad = await post('/import/preview', adminToken, Buffer.alloc(500, 1));
  assert.equal(bad.status, 400);
});

test('commit imports, is repeatable, and payroll = daily rate x paid days - advances', async () => {
  const file = await workbook();
  const c1 = await post('/import/commit', adminToken, file);
  assert.equal(c1.status, 200);
  assert.equal(c1.body.created, 1);
  const c2 = await post('/import/commit', adminToken, file);
  assert.equal(c2.body.updated, 1);
  assert.equal(await prisma.attendance.count({ where: { employee: { employeeNumber: '901' } } }), 3);
  assert.equal(await prisma.advance.count({ where: { employee: { employeeNumber: '901' } } }), 2);

  const gen = await api.call('POST', '/payroll/generate', {
    token: adminToken,
    body: {
      month: MONTH,
      year: YEAR,
      employeeIds: [(await prisma.employee.findUnique({ where: { employeeNumber: '901' } })).id]
    }
  });
  assert.equal(gen.status, 200);
  const p = gen.body.payrolls[0];
  // paid days: PRESENT + MISSION = 2 -> 2 x 500 = 1000, minus advance 200 and deduction 100
  assert.equal(Number(p.netSalary), 700);
  assert.equal(Number(p.advanceDeductions), 300);
  assert.equal(p.presentDays, 2);
  assert.equal(p.absentDays, 1);
});
