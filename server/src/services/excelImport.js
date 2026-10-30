// Import employees, daily attendance and advances from an Excel workbook (.xlsx / .xlsm).
// The file is only READ as data; macros are never executed or stored.
//
// Expected sheets
// - "Employee Attendance": header row with كود الموظف | الموظف | الوظيفة | عدد أيام العمل |
//   الراتب الأساسي | قيمة الاجر اليومي, then one column per day ("01-Oct ...") holding
//   ح (present) / غ (absent) / إ (leave) / م (mission, paid like a present day).
// - "Employee Advances" (optional): first column = employee name, then one column per day
//   with the advance amount, and an optional "الخصومات" column (month deductions).
const ExcelJS = require('exceljs');

const SHEET_ATTENDANCE = 'Employee Attendance';
const SHEET_ADVANCES = 'Employee Advances';
const STATUS_BY_SYMBOL = { ح: 'PRESENT', غ: 'ABSENT', إ: 'ON_LEAVE', م: 'MISSION' };
const DAILY_PAY_MAX_WORK_DAYS = 15; // up to this many working days a month => paid by the day

function cellValue(cell) {
  let v = cell.value;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) v = v.result;
    else if (Array.isArray(v.richText)) v = v.richText.map((t) => t.text).join('');
    else if ('text' in v) v = v.text;
  }
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && !(v instanceof Date)) return '';
  return v;
}

const text = (v) => String(v instanceof Date ? '' : v).trim();
const number = (v) => {
  const n = Number(String(v).replace(/,/g, '').trim());
  return String(v).trim() === '' || Number.isNaN(n) ? null : n;
};
const normalizeName = (s) => text(s).replace(/\s+/g, ' ');
const day = (year, month, d) => new Date(Date.UTC(year, month - 1, d));

function findHeaderRow(ws, label) {
  for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
    for (let c = 1; c <= 3; c++) if (text(cellValue(ws.getRow(r).getCell(c))) === label) return r;
  }
  return null;
}

function headerMap(row) {
  const map = {};
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const label = text(cellValue(cell)).replace(/\s+/g, ' ');
    if (label) map[label] = col;
  });
  return map;
}

function dayColumns(row, month, year) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out = [];
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const v = cellValue(cell);
    let d = null;
    if (v instanceof Date) {
      if (v.getUTCFullYear() === year && v.getUTCMonth() + 1 === month) d = v.getUTCDate();
    } else {
      const m = /^(\d{1,2})-[A-Za-z]{3}/.exec(text(v)) || /^\d{4}-\d{2}-(\d{2})/.exec(text(v));
      if (m) d = Number(m[1]);
    }
    if (d && d >= 1 && d <= daysInMonth) out.push({ col, day: d });
  });
  return out;
}

async function parseWorkbook(buffer, { month, year }) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const errors = [];
  const warnings = [];
  const employees = [];
  const attendance = [];
  const advances = [];

  const ws = wb.getWorksheet(SHEET_ATTENDANCE);
  if (!ws) throw new Error(`Sheet "${SHEET_ATTENDANCE}" was not found`);
  const headerRowNo = findHeaderRow(ws, 'كود الموظف');
  if (!headerRowNo) throw new Error('Header row (كود الموظف) was not found');
  const header = ws.getRow(headerRowNo);
  const cols = headerMap(header);
  for (const need of ['كود الموظف', 'الموظف', 'الراتب الأساسي']) {
    if (!cols[need]) throw new Error(`Column "${need}" is missing`);
  }
  const days = dayColumns(header, month, year);
  if (!days.length) throw new Error('No day columns were found for the selected month');

  const seen = new Set();
  for (let r = headerRowNo + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const code = text(cellValue(row.getCell(cols['كود الموظف'])));
    const name = normalizeName(cellValue(row.getCell(cols['الموظف'])));
    if (!code && !name) continue;
    if (!code || !name) {
      const hasData = [...days.map((d) => d.col), cols['الراتب الأساسي']].some(
        (c) => text(cellValue(row.getCell(c))) !== ''
      );
      const issue = { sheet: SHEET_ATTENDANCE, row: r, message: 'Employee code or name is missing' };
      if (hasData) errors.push(issue);
      else warnings.push({ ...issue, message: `${issue.message}; empty row skipped` });
      continue;
    }
    if (seen.has(code)) {
      errors.push({ sheet: SHEET_ATTENDANCE, row: r, message: `Duplicate employee code ${code}` });
      continue;
    }
    const rawSalary = text(cellValue(row.getCell(cols['الراتب الأساسي'])));
    let salary = number(rawSalary);
    if (rawSalary !== '' && (salary === null || salary < 0)) {
      errors.push({ sheet: SHEET_ATTENDANCE, row: r, message: 'Basic salary is not a valid number' });
      continue;
    }
    if (rawSalary === '') {
      salary = 0;
      warnings.push({
        sheet: SHEET_ATTENDANCE,
        row: r,
        message: `Employee ${code} has no salary in the file; imported with 0, set it manually`
      });
    }
    const rateCol = cols['قيمة الاجر اليومي'];
    const dailyRate = rateCol ? number(cellValue(row.getCell(rateCol))) : null;
    const workDays = cols['عدد أيام العمل'] ? number(cellValue(row.getCell(cols['عدد أيام العمل']))) : null;
    const jobTitle = cols['الوظيفة'] ? text(cellValue(row.getCell(cols['الوظيفة']))) : '';

    const emp = {
      employeeNumber: code,
      fullName: name,
      jobTitle: jobTitle || null,
      salary,
      dailyRate: dailyRate && dailyRate > 0 ? dailyRate : null,
      payType: workDays !== null && workDays <= DAILY_PAY_MAX_WORK_DAYS ? 'DAILY' : 'MONTHLY'
    };
    seen.add(code);
    employees.push(emp);

    for (const { col, day: d } of days) {
      const symbol = text(cellValue(row.getCell(col)));
      if (!symbol) continue;
      const status = STATUS_BY_SYMBOL[symbol];
      if (!status) {
        errors.push({ sheet: SHEET_ATTENDANCE, row: r, message: `Unknown attendance symbol "${symbol}" on day ${d}` });
        continue;
      }
      attendance.push({ employeeNumber: code, date: day(year, month, d), status });
    }
  }

  const wsAdv = wb.getWorksheet(SHEET_ADVANCES);
  if (wsAdv) {
    const advHeaderNo = findHeaderRow(wsAdv, 'الموظفين');
    if (!advHeaderNo) {
      warnings.push({
        sheet: SHEET_ADVANCES,
        row: 0,
        message: 'Header row (الموظفين) was not found; advances skipped'
      });
    } else {
      const advHeader = wsAdv.getRow(advHeaderNo);
      const advCols = headerMap(advHeader);
      const advDays = dayColumns(advHeader, month, year);
      const byName = new Map(employees.map((e) => [e.fullName, e]));
      for (let r = advHeaderNo + 1; r <= wsAdv.rowCount; r++) {
        const row = wsAdv.getRow(r);
        const name = normalizeName(cellValue(row.getCell(1)));
        if (!name) continue;
        const emp = byName.get(name);
        let any = false;
        const entries = [];
        for (const { col, day: d } of advDays) {
          const amount = number(cellValue(row.getCell(col)));
          if (amount) entries.push({ date: day(year, month, d), amount, kind: 'ADVANCE' });
        }
        const ded = advCols['الخصومات'] ? number(cellValue(row.getCell(advCols['الخصومات']))) : null;
        if (ded)
          entries.push({
            date: day(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate()),
            amount: ded,
            kind: 'DEDUCTION'
          });
        any = entries.length > 0;
        if (!emp) {
          if (any)
            warnings.push({
              sheet: SHEET_ADVANCES,
              row: r,
              message: 'Advance row does not match any employee name; skipped'
            });
          continue;
        }
        for (const e of entries) {
          if (e.amount < 0) errors.push({ sheet: SHEET_ADVANCES, row: r, message: 'Negative amount' });
          else advances.push({ employeeNumber: emp.employeeNumber, ...e });
        }
      }
    }
  } else {
    warnings.push({ sheet: SHEET_ADVANCES, row: 0, message: 'Advances sheet not found; no advances imported' });
  }

  const sum = (kind) => advances.filter((a) => a.kind === kind).reduce((s, a) => s + a.amount, 0);
  return {
    month,
    year,
    employees,
    attendance,
    advances,
    errors,
    warnings,
    summary: {
      employees: employees.length,
      attendanceRecords: attendance.length,
      advanceRecords: advances.length,
      advancesTotal: sum('ADVANCE'),
      deductionsTotal: sum('DEDUCTION'),
      errors: errors.length,
      warnings: warnings.length
    }
  };
}

const IMPORT_NOTE = 'excel-import';

// Writes a parsed workbook. Re-importing the same month is safe: employees are matched by
// number, attendance by (employee, day), and the month's imported advances are replaced.
async function commitImport(prisma, parsed) {
  const { month, year } = parsed;
  const monthStart = day(year, month, 1);
  const monthEnd = day(year, month + 1, 0);
  return prisma.$transaction(
    async (tx) => {
      const ids = new Map();
      let created = 0;
      let updated = 0;
      for (const e of parsed.employees) {
        const existing = await tx.employee.findUnique({ where: { employeeNumber: e.employeeNumber } });
        const data = {
          fullName: e.fullName,
          jobTitle: e.jobTitle,
          salary: e.salary,
          dailyRate: e.dailyRate,
          payType: e.payType
        };
        if (existing) {
          await tx.employee.update({ where: { id: existing.id }, data });
          ids.set(e.employeeNumber, existing.id);
          updated += 1;
        } else {
          const row = await tx.employee.create({
            data: {
              ...data,
              employeeNumber: e.employeeNumber,
              email: `emp${e.employeeNumber}@import.local`,
              hireDate: monthStart,
              status: 'ACTIVE'
            }
          });
          ids.set(e.employeeNumber, row.id);
          created += 1;
        }
      }
      for (const a of parsed.attendance) {
        const employeeId = ids.get(a.employeeNumber);
        await tx.attendance.upsert({
          where: { employeeId_date: { employeeId, date: a.date } },
          update: { status: a.status, deviceInfo: IMPORT_NOTE },
          create: {
            employeeId,
            date: a.date,
            status: a.status,
            lateMinutes: 0,
            overtimeMinutes: 0,
            deviceInfo: IMPORT_NOTE
          }
        });
      }
      await tx.advance.deleteMany({
        where: { employeeId: { in: [...ids.values()] }, date: { gte: monthStart, lte: monthEnd }, note: IMPORT_NOTE }
      });
      if (parsed.advances.length) {
        await tx.advance.createMany({
          data: parsed.advances.map((a) => ({
            employeeId: ids.get(a.employeeNumber),
            date: a.date,
            amount: a.amount,
            kind: a.kind,
            note: IMPORT_NOTE
          }))
        });
      }
      return { created, updated, attendance: parsed.attendance.length, advances: parsed.advances.length };
    },
    { timeout: 60000 }
  );
}

module.exports = { parseWorkbook, commitImport, STATUS_BY_SYMBOL };
