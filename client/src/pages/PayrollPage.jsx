import { useState } from 'react';
import api from '../api/axios';
import {
  Alert, Badge, DataTable, MONTHS, MonthYearPicker, PageHeader, btnPrimary, errorMessage, fmtMoney, isAdmin, useApi
} from '../components/ui';

export default function PayrollPage() {
  const admin = isAdmin();
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const { data, loading, error, reload } = useApi('/payroll', admin ? period : {});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: 'success', text: '' });

  const generate = async () => {
    if (!window.confirm(`إنشاء رواتب ${MONTHS[period.month - 1]} ${period.year} لكل الموظفين النشطين؟`)) return;
    setBusy(true);
    try {
      const res = await api.post('/payroll/generate', period);
      setNotice({ type: 'success', text: `تم إنشاء ${res.data.generated} سجل${res.data.skipped ? `، وتم تخطي ${res.data.skipped} موجود مسبقًا` : ''}` });
      reload();
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (p) => {
    try {
      await api.put(`/payroll/${p.id}/mark-paid`);
      reload();
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err) });
    }
  };

  const totalNet = (data || []).reduce((acc, p) => acc + Number(p.netSalary), 0);

  const columns = [
    ...(admin ? [{ label: 'الموظف', render: (r) => <div><p className="font-semibold">{r.employee?.fullName}</p><p className="text-slate-500">{r.employee?.employeeNumber}</p></div> }] : []),
    { label: 'الفترة', render: (r) => `${MONTHS[Number(r.month) - 1] || r.month} ${r.year}` },
    { label: 'الأساسي', render: (r) => fmtMoney(r.basicSalary) },
    { label: 'أيام الحضور', key: 'presentDays' },
    { label: 'أيام الغياب', key: 'absentDays' },
    { label: 'ساعات إضافية', render: (r) => Number(r.overtimeHours) },
    { label: 'الخصومات', render: (r) => fmtMoney(r.lateDeductions) },
    { label: 'الصافي', render: (r) => <b>{fmtMoney(r.netSalary)}</b> },
    { label: 'الصرف', render: (r) => (r.paid ? <Badge tone="green">تم الصرف</Badge> : <Badge tone="amber">لم يُصرف</Badge>) },
    ...(admin ? [{ label: 'الإجراء', render: (r) => (!r.paid ? <button className="text-blue-600" onClick={() => markPaid(r)}>تأكيد الصرف</button> : '—') }] : [])
  ];

  return (
    <div>
      <PageHeader title="الرواتب" subtitle={admin && data?.length ? `${data.length} سجل — إجمالي الصافي ${fmtMoney(totalNet)}` : ''}>
        {admin && (
          <>
            <MonthYearPicker month={period.month} year={period.year} onChange={setPeriod} />
            <button className={btnPrimary} disabled={busy} onClick={generate}>{busy ? 'جارٍ الإنشاء...' : 'إنشاء رواتب الشهر'}</button>
          </>
        )}
      </PageHeader>
      <Alert type={notice.type} onClose={() => setNotice({ ...notice, text: '' })}>{notice.text}</Alert>
      <Alert>{error}</Alert>
      <DataTable columns={columns} rows={data} loading={loading} empty={admin ? 'لا توجد رواتب لهذا الشهر — اضغط "إنشاء رواتب الشهر"' : 'لا توجد رواتب بعد'} />
    </div>
  );
}
