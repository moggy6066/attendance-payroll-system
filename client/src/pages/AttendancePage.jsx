import { useState } from 'react';
import api from '../api/axios';
import {
  ATTENDANCE_STATUS, Alert, Card, DataTable, PageHeader, StatusBadge, btnPrimary, btnSecondary, currentUser,
  errorMessage, fmtDate, fmtTime, inputClass, isAdmin, todayISO, useApi
} from '../components/ui';

function CheckInCard() {
  const user = currentUser();
  const { data, loading, reload } = useApi(user?.employee ? '/attendance/today' : null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: 'success', text: '' });

  if (!user?.employee) return null;
  const today = data?.attendance;

  const getPosition = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => resolve({}),
        { timeout: 5000 }
      );
    });

  const act = async (kind) => {
    setBusy(true);
    setMsg({ type: 'success', text: '' });
    try {
      const pos = await getPosition();
      await api.post(`/attendance/${kind}`, pos);
      setMsg({ type: 'success', text: kind === 'check-in' ? 'تم تسجيل الحضور' : 'تم تسجيل الانصراف' });
      reload();
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6">
      <Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">اليوم {todayISO()}</p>
          <p className="mt-1 text-lg font-semibold">
            {loading ? '...' : today?.checkIn
              ? `حضور ${fmtTime(today.checkIn)}${today.checkOut ? ` — انصراف ${fmtTime(today.checkOut)}` : ''}`
              : 'لم تسجل حضورك بعد'}
          </p>
          {today?.status && <div className="mt-2"><StatusBadge map={ATTENDANCE_STATUS} value={today.status} /></div>}
        </div>
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={busy || loading || !!today?.checkIn} onClick={() => act('check-in')}>تسجيل حضور</button>
          <button className={btnSecondary} disabled={busy || loading || !today?.checkIn || !!today?.checkOut} onClick={() => act('check-out')}>تسجيل انصراف</button>
        </div>
      </div>
    </Card>
  );
}

const baseColumns = [
  { label: 'التاريخ', render: (r) => fmtDate(r.date) },
  { label: 'الدخول', render: (r) => fmtTime(r.checkIn) },
  { label: 'الخروج', render: (r) => fmtTime(r.checkOut) },
  { label: 'التأخير (د)', render: (r) => r.lateMinutes || 0 },
  { label: 'إضافي (د)', render: (r) => r.overtimeMinutes || 0 },
  { label: 'الحالة', render: (r) => <StatusBadge map={ATTENDANCE_STATUS} value={r.status} /> }
];

function AdminAttendance() {
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useApi('/attendance', { date, ...(status ? { status } : {}) });
  const [marking, setMarking] = useState(false);
  const [markMsg, setMarkMsg] = useState({ type: 'success', text: '' });
  const isPast = date < todayISO();
  const markAbsences = async () => {
    setMarking(true);
    try {
      const res = await api.post('/attendance/mark-absences', { date });
      const r = res.data;
      setMarkMsg({ type: 'success', text: r.skipped ? 'هذا اليوم إجازة أسبوعية أو عطلة رسمية' : `تم تسجيل ${r.absent} غياب و${r.onLeave} إجازة` });
      reload();
    } catch (err) {
      setMarkMsg({ type: 'error', text: errorMessage(err) });
    } finally {
      setMarking(false);
    }
  };
  const columns = [
    { label: 'الموظف', render: (r) => <div><p className="font-semibold">{r.employee?.fullName}</p><p className="text-slate-500">{r.employee?.employeeNumber}</p></div> },
    { label: 'القسم', render: (r) => r.employee?.department?.name || '—' },
    ...baseColumns
  ];
  return (
    <>
      <Alert>{error}</Alert>
      <Alert type={markMsg.type} onClose={() => setMarkMsg({ ...markMsg, text: '' })}>{markMsg.text}</Alert>
      <div className="mb-4 flex flex-wrap gap-3">
        {isPast && <button className={btnSecondary} disabled={marking} onClick={markAbsences}>{marking ? '...' : 'تسجيل غياب من لم يحضر'}</button>}
        <input type="date" className={`${inputClass} max-w-xs`} value={date} onChange={(e) => setDate(e.target.value)} />
        <select className={`${inputClass} max-w-xs`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {Object.entries(ATTENDANCE_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <DataTable columns={columns} rows={data} loading={loading} empty="لا توجد سجلات لهذا اليوم" />
    </>
  );
}

function MyAttendance() {
  const user = currentUser();
  const { data, loading, error } = useApi(user?.employee ? `/attendance/employee/${user.employee.id}` : null);
  if (!user?.employee) return <Alert type="info">هذا الحساب غير مرتبط بموظف.</Alert>;
  const s = data?.stats;
  return (
    <>
      <Alert>{error}</Alert>
      {s && (
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <span>حضور: <b>{s.present}</b></span><span>تأخير: <b>{s.late}</b></span>
          <span>غياب: <b>{s.absent}</b></span><span>إجازة: <b>{s.onLeave}</b></span>
        </div>
      )}
      <DataTable columns={baseColumns} rows={data?.attendance} loading={loading} />
    </>
  );
}

export default function AttendancePage() {
  const admin = isAdmin();
  const [view, setView] = useState(admin ? 'all' : 'mine');
  return (
    <div>
      <PageHeader title="الحضور والانصراف">
        {admin && (
          <>
            <button className={view === 'all' ? btnPrimary : btnSecondary} onClick={() => setView('all')}>كل الموظفين</button>
            <button className={view === 'mine' ? btnPrimary : btnSecondary} onClick={() => setView('mine')}>سجلي</button>
          </>
        )}
      </PageHeader>
      <CheckInCard />
      {view === 'all' ? <AdminAttendance /> : <MyAttendance />}
    </div>
  );
}
