import { useState } from 'react';
import api from '../api/axios';
import {
  Alert, DataTable, Field, LEAVE_STATUS, LEAVE_TYPES, Modal, PageHeader, StatusBadge, btnPrimary, btnSecondary,
  currentUser, errorMessage, fmtDate, inputClass, isAdmin, useApi
} from '../components/ui';

const emptyForm = { type: 'ANNUAL', startDate: '', endDate: '', reason: '' };

export default function LeavePage() {
  const admin = isAdmin();
  const user = currentUser();
  const [status, setStatus] = useState(admin ? 'PENDING' : '');
  const { data, loading, error, reload } = useApi('/leave-requests', status ? { status } : {});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const days = form.startDate && form.endDate
    ? Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1
    : 0;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post('/leave-requests', form);
      setOpen(false);
      setForm(emptyForm);
      setNotice('تم إرسال طلب الإجازة');
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (leave, action) => {
    let body = {};
    if (action === 'reject') {
      const reason = window.prompt('سبب الرفض (اختياري)');
      if (reason === null) return;
      body = { reason };
    }
    try {
      await api.put(`/leave-requests/${leave.id}/${action}`, body);
      setNotice(action === 'approve' ? 'تمت الموافقة' : 'تم الرفض');
      reload();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const columns = [
    ...(admin ? [{ label: 'الموظف', render: (r) => r.employee?.fullName }] : []),
    { label: 'النوع', render: (r) => LEAVE_TYPES[r.type] || r.type },
    { label: 'من', render: (r) => fmtDate(r.startDate) },
    { label: 'إلى', render: (r) => fmtDate(r.endDate) },
    { label: 'الأيام', key: 'days' },
    { label: 'السبب', render: (r) => <span className="block max-w-xs truncate" title={r.reason}>{r.reason}</span> },
    { label: 'الحالة', render: (r) => <StatusBadge map={LEAVE_STATUS} value={r.status} /> },
    ...(admin
      ? [{
          label: 'الإجراء',
          render: (r) => r.status === 'PENDING' ? (
            <div className="flex gap-3">
              <button className="text-emerald-600" onClick={() => decide(r, 'approve')}>موافقة</button>
              <button className="text-red-600" onClick={() => decide(r, 'reject')}>رفض</button>
            </div>
          ) : '—'
        }]
      : [])
  ];

  return (
    <div>
      <PageHeader title="إدارة الإجازات">
        <select className={`${inputClass} w-44`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الطلبات</option>
          {Object.entries(LEAVE_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {user?.employee && <button className={btnPrimary} onClick={() => { setFormError(''); setOpen(true); }}>طلب إجازة</button>}
      </PageHeader>

      <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>
      <Alert>{error}</Alert>
      <DataTable columns={columns} rows={data} loading={loading} empty="لا توجد طلبات" />

      <Modal open={open} title="طلب إجازة جديد" onClose={() => setOpen(false)}>
        <Alert>{formError}</Alert>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Field label="نوع الإجازة">
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(LEAVE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <div className="flex items-end text-sm text-slate-500">{days > 0 ? `عدد الأيام: ${days}` : ''}</div>
          <Field label="من *"><input required type="date" className={inputClass} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="إلى *"><input required type="date" min={form.startDate} className={inputClass} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
          <div className="md:col-span-2">
            <Field label="السبب *"><textarea required minLength={3} rows={3} className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'جارٍ الإرسال...' : 'إرسال'}</button>
            <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
