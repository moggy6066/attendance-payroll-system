const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { parseWorkbook } = require('../src/services/excelImport');

// Builds a small workbook with FAKE data in the same layout as the real file.
async function build({ extraAttendanceRows = [], advanceRows } = {}) {
  const wb = new ExcelJS.Workbook();
  const att = wb.addWorksheet('Employee Attendance');
  att.addRow(['سجل الحضور']);
  att.addRow(['الرموز']);
  att.addRow([
    'كود الموظف',
    'الموظف',
    'الوظيفة',
    'عدد أيام العمل',
    'الراتب الأساسي',
    'قيمة الاجر اليومي',
    'صافي',
    '01-Oct الخميس',
    '02-Oct الجمعة',
    '03-Oct السبت'
  ]);
  att.addRow(['101', 'موظف أول', 'اخصائية', 8, '4000', '500', 0, 'ح', 'م', null]);
  att.addRow(['104', 'موظف ثان', 'مشرف', 30, '10000', '334', 0, 'ح', 'غ', 'إ']);
  for (const r of extraAttendanceRows) att.addRow(r);
  const adv = wb.addWorksheet('Employee Advances');
  adv.addRow(['السلف']);
  adv.addRow([]);
  adv.addRow(['الموظفين', '2026-10-01', '2026-10-02', '2026-10-03', 'الخصومات', 'اجمالي']);
  for (const r of advanceRows || [
    ['موظف أول', 0, 300, 0, 100, 300],
    ['شخص غريب', 50, 0, 0, null, 50]
  ])
    adv.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test('parses employees, statuses (including mission) and advances', async () => {
  const p = await parseWorkbook(await build(), { month: 10, year: 2026 });
  assert.equal(p.employees.length, 2);
  assert.equal(p.employees[0].payType, 'DAILY');
  assert.equal(p.employees[1].payType, 'MONTHLY');
  assert.equal(p.employees[0].dailyRate, 500);
  const statuses = p.attendance.map((a) => a.status);
  assert.deepEqual(statuses, ['PRESENT', 'MISSION', 'PRESENT', 'ABSENT', 'ON_LEAVE']);
  assert.equal(p.attendance[0].date.toISOString().slice(0, 10), '2026-10-01');
  assert.equal(p.summary.advancesTotal, 300);
  assert.equal(p.summary.deductionsTotal, 100);
  assert.equal(p.errors.length, 0);
  assert.equal(p.warnings.length, 1); // unknown advance name
});

test('reports duplicate codes, bad salary and unknown symbols as errors', async () => {
  const buf = await build({
    extraAttendanceRows: [
      ['101', 'مكرر', 'x', 8, '1000', '100', 0, 'ح'],
      ['105', 'راتب خاطئ', 'x', 8, 'abc', '100', 0, 'ح'],
      ['106', 'رمز خاطئ', 'x', 8, '1000', '100', 0, 'ز']
    ]
  });
  const p = await parseWorkbook(buf, { month: 10, year: 2026 });
  const msgs = p.errors.map((e) => e.message).join('|');
  assert.match(msgs, /Duplicate employee code 101/);
  assert.match(msgs, /Basic salary/);
  assert.match(msgs, /Unknown attendance symbol/);
  assert.equal(p.errors.length, 3);
});

test('fails clearly when the sheet is missing', async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Other');
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  await assert.rejects(parseWorkbook(buf, { month: 10, year: 2026 }), /Employee Attendance/);
});
