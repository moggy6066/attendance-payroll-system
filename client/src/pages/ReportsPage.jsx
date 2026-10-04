import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import {
  ATTENDANCE_STATUS, Alert, Card, DataTable, LEAVE_STATUS, LEAVE_TYPES, MonthYearPicker, PageHeader, StatusBadge,
  btnPrimary, btnSecondary, downloadFile, errorMessage, fmtMoney, inputClass, todayISO, useApi
} from '../components/ui';
import StatCard from '../components/StatCard';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const TABS = [
  ['daily', 'الحضور اليومي'],
  ['employees', 'الغياب والتأخير والإضافي'],
  ['monthly', 'الحضور حسب القسم'],
  ['leaves', 'الإجازات'],
  ['payroll', 'الرواتب'],
  ['departments', 'الموظفين حسب القسم']
];

const EXPORT_TYPE = {
  daily: 'attendance-daily',
  employees: 'attendance-employees',
  monthly: 'attendance-monthly',
  leaves: 'leaves',
  payroll: 'payroll',
  departments: 'employees'
};

const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)}س ${m % 60}د` : `${m}د`);

function DailyReport({ date }) {
  const { data, loading, error } = useApi('/reports/attendance/daily', { date });
  const s = data?.summary;
  return (
    <>
      <Alert>{error}</Alert>
      {s && (
        <div className="mb-4 grid gap-4 md:grid-cols-5">
          <StatCard title="حاضر" value={s.present} tone="green" />
          <StatCard title="متأخر" value={s.late} tone="amber" />
          <StatCard title="غائب" value={s.absent} tone="red" />
          <StatCard title="إجازة" value={s.onLeave} tone="blue" />
          <StatCard title="بدون تسجيل" value={s.notRecorded} tone="slate" />
        </div>
      )}
      <DataTable loading={loading} rows={data?.details} empty="لا توجد سجلات لهذا اليوم" columns={[
        { label: 'الموظف', key: 'fullName' }, { label: 'الرقم', key: 'employeeNumber' }, { label: 'القسم', key: 'department' },
        { label: 'الدخول', render: (r) => r.checkIn || '—' }, { label: 'الخروج', render: (r) => r.checkOut || '—' },
        { label: 'التأخير', render: (r) => mins(r.lateMinutes) }, { label: 'إضافي', render: (r) => mins(r.overtimeMinutes) },
        { label: 'الحالة', render: (r) => <StatusBadge map={ATTENDANCE_STATUS} value={r.status} /> }
      ]} />
    </>
  );
}

function EmployeesReport({ period }) {
  const { data, loading, error } = useApi('/reports/attendance/employees', period);
  const t = data?.totals;
  return (
    <>
      <Alert>{error}</Alert>
      {t && (
        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <StatCard title="إجمالي أيام الغياب" value={t.absentDays} tone="red" />
          <StatCard title="إجمالي أيام التأخير" value={t.lateDays} tone="amber" />
          <StatCard title="إجمالي التأخير" value={mins(t.totalLateMinutes)} tone="amber" />
          <StatCard title="إجمالي الوقت الإضافي" value={mins(t.totalOvertimeMinutes)} tone="green" />
        </div>
      )}
      <DataTable loading={loading} rows={data?.rows} rowKey="employeeId" columns={[
        { label: 'الموظف', key: 'fullName' }, { label: 'الرقم', key: 'employeeNumber' }, { label: 'القسم', key: 'department' },
        { label: 'حضور', key: 'presentDays' }, { label: 'تأخير (أيام)', key: 'lateDays' },
        { label: 'غياب', render: (r) => <span className={r.absentDays ? 'font-bold text-red-600' : ''}>{r.absentDays}</span> },
        { label: 'إجازة', key: 'leaveDays' }, { label: 'دقائق التأخير', render: (r) => mins(r.totalLateMinutes) },
        { label: 'إضافي', render: (r) => mins(r.totalOvertimeMinutes) }, { label: 'ساعات العمل', key: 'workedHours' }
      ]} />
    </>
  );
}

function MonthlyReport({ period }) {
  const { data, loading, error } = useApi('/reports/attendance/monthly', period);
  const rows = Object.entries(data?.byDepartment || {}).map(([department, d]) => ({ department, ...d }));
  return (
    <>
      <Alert>{error}</Alert>
      {rows.length > 0 && (
        <Card className="mb-4">
          <Bar data={{
            labels: rows.map((r) => r.department),
            datasets: [
              { label: 'حضور', data: rows.map((r) => r.present), backgroundColor: '#10b981' },
              { label: 'تأخير', data: rows.map((r) => r.late), backgroundColor: '#f59e0b' },
              { label: 'غياب', data: rows.map((r) => r.absent), backgroundColor: '#ef4444' },
              { label: 'إجازة', data: rows.map((r) => r.onLeave), backgroundColor: '#3b82f6' }
            ]
          }} options={{ responsive: true, scales: { x: { stacked: true }, y: { stacked: true } } }} />
        </Card>
      )}
      <DataTable loading={loading} rows={rows} rowKey="department" columns={[
        { label: 'القسم', key: 'department' }, { label: 'حضور', key: 'present' }, { label: 'تأخير', key: 'late' },
        { label: 'غياب', key: 'absent' }, { label: 'إجازة', key: 'onLeave' }, { label: 'إجمالي التأخير', render: (r) => mins(r.lateMinutes) }
      ]} />
    </>
  );
}

function LeavesReport({ period }) {
  const { data, loading, error } = useApi('/reports/leaves/summary', period);
  return (
    <>
      <Alert>{error}</Alert>
      {data && (
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          <StatCard title="قيد المراجعة" value={data.pending} tone="amber" />
          <StatCard title="موافق عليها" value={data.approved} tone="green" />
          <StatCard title="مرفوضة" value={data.rejected} tone="red" />
        </div>
      )}
      <DataTable loading={loading} rows={data?.details} empty="لا توجد إجازات في هذا الشهر" columns={[
        { label: 'الموظف', key: 'fullName' }, { label: 'النوع', render: (r) => LEAVE_TYPES[r.type] },
        { label: 'من', key: 'startDate' }, { label: 'إلى', key: 'endDate' }, { label: 'الأيام', key: 'days' },
        { label: 'الحالة', render: (r) => <StatusBadge map={LEAVE_STATUS} value={r.status} /> }
      ]} />
    </>
  );
}

function PayrollReport({ period }) {
  const { data, loading, error } = useApi('/reports/payroll/summary', period);
  return (
    <>
      <Alert>{error}</Alert>
      {data && (
        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <StatCard title="عدد السجلات" value={`${data.paidRecords}/${data.totalRecords} مصروف`} tone="slate" />
          <StatCard title="إجمالي الصافي" value={fmtMoney(data.totalSalary)} tone="green" />
          <StatCard title="إجمالي الخصومات" value={fmtMoney(data.totalDeductions)} tone="red" />
          <StatCard title="متوسط الراتب" value={fmtMoney(data.averageSalary)} tone="blue" />
        </div>
      )}
      <DataTable loading={loading} rows={data?.details} empty="لم يتم إنشاء رواتب هذا الشهر بعد" columns={[
        { label: 'الموظف', key: 'fullName' }, { label: 'القسم', key: 'department' }, { label: 'الأساسي', render: (r) => fmtMoney(r.basicSalary) },
        { label: 'غياب', key: 'absentDays' }, { label: 'الخصومات', render: (r) => fmtMoney(r.deductions) },
        { label: 'الصافي', render: (r) => <b>{fmtMoney(r.netSalary)}</b> }, { label: 'الصرف', render: (r) => (r.paid ? 'نعم' : 'لا') }
      ]} />
    </>
  );
}

function DepartmentsReport() {
  const { data, loading, error } = useApi('/reports/employees/by-department');
  return (
    <>
      <Alert>{error}</Alert>
      <DataTable loading={loading} rows={data} rowKey="department" columns={[
        { label: 'القسم', key: 'department' }, { label: 'عدد الموظفين النشطين', key: 'employeeCount' },
        { label: 'الموظفين', render: (r) => <span className="block max-w-xl truncate">{r.employees.map((e) => e.fullName).join('، ')}</span> }
      ]} />
    </>
  );
}

export default function ReportsPage() {
  const now = new Date();
  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(todayISO());
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const exportExcel = async () => {
    setExporting(true);
    setExportError('');
    try {
      const type = EXPORT_TYPE[tab];
      const params = tab === 'daily' ? { date } : period;
      const suffix = tab === 'daily' ? date : `${period.year}-${String(period.month).padStart(2, '0')}`;
      await downloadFile(`/reports/export/${type}`, params, `${type}-${suffix}.xlsx`);
    } catch (err) {
      setExportError(errorMessage(err, 'فشل التصدير'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader title="التقارير">
        {tab === 'daily' && <input type="date" className={`${inputClass} w-44`} value={date} onChange={(e) => setDate(e.target.value)} />}
        {tab !== 'daily' && tab !== 'departments' && <MonthYearPicker month={period.month} year={period.year} onChange={setPeriod} />}
        <button className={btnPrimary} onClick={exportExcel} disabled={exporting}>{exporting ? 'جارٍ التصدير...' : 'تصدير Excel'}</button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? btnPrimary : btnSecondary} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      <Alert onClose={() => setExportError('')}>{exportError}</Alert>

      {tab === 'daily' && <DailyReport date={date} />}
      {tab === 'employees' && <EmployeesReport period={period} />}
      {tab === 'monthly' && <MonthlyReport period={period} />}
      {tab === 'leaves' && <LeavesReport period={period} />}
      {tab === 'payroll' && <PayrollReport period={period} />}
      {tab === 'departments' && <DepartmentsReport />}
    </div>
  );
}
