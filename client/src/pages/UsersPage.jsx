import { useState } from 'react';
import api from '../api/axios';
import {
  Alert, DataTable, Field, Modal, PageHeader, ROLES, StatusBadge, USER_STATUS, btnPrimary, btnSecondary,
  currentRole, currentUser, errorMessage, fmtDate, inputClass, useApi
} from '../components/ui';

const emptyForm = { username: '', email: '', password: '', role: 'EMPLOYEE', status: 'ACTIVE', employeeId: '' };

export default function UsersPage() {
  const superAdmin = currentRole() === 'SUPER_ADMIN';
  const me = currentUser();
  const { data, loading, error, reload } = useApi('/users');
  const { data: employees } = useApi(superAdmin ? '/employees' : null);
  const [modal, setModal] = useState(null); // null | 'create' | user
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => { setForm(emptyForm); setFormError(''); setModal('create'); };
  const openEdit = (u) => {
    setForm({ username: u.username, email: u.email, password: '', role: u.role, status: u.status, employeeId: u.employeeId || '' });
    setFormError('');
    setModal(u);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, employeeId: form.employeeId || null };
      if (!payload.password) delete payload.password;
      if (modal === 'create') {
        delete payload.status;
        await api.post('/users', payload);
        setNotice('تم إنشاء المستخدم');
      } else {
        await api.put(`/users/${modal.id}`, payload);
        setNotice('تم حفظ التعديلات');
      }
      setModal(null);
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`حذف المستخدم ${u.username}؟`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      setNotice('تم حذف المستخدم');
      reload();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const columns = [
    { label: 'اسم المستخدم', key: 'username' },
    { label: 'البريد', key: 'email' },
    { label: 'الموظف', render: (r) => r.employee?.fullName || '—' },
    { label: 'الدور', render: (r) => ROLES[r.role] || r.role },
    { label: 'الحالة', render: (r) => <StatusBadge map={USER_STATUS} value={r.status} /> },
    { label: 'آخر دخول', render: (r) => fmtDate(r.lastLogin) },
    ...(superAdmin
      ? [{
          label: 'الإجراء',
          render: (r) => (
            <div className="flex gap-3">
              <button className="text-blue-600" onClick={() => openEdit(r)}>تعديل</button>
              {r.id !== me.id && <button className="text-red-600" onClick={() => remove(r)}>حذف</button>}
            </div>
          )
        }]
      : [])
  ];

  return (
    <div>
      <PageHeader title="إدارة المستخدمين" subtitle={superAdmin ? '' : 'عرض فقط — التعديل متاح للمدير العام'}>
        {superAdmin && <button className={btnPrimary} onClick={openCreate}>إضافة مستخدم</button>}
      </PageHeader>
      <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>
      <Alert>{error}</Alert>
      <DataTable columns={columns} rows={data} loading={loading} />

      <Modal open={!!modal} title={modal === 'create' ? 'إضافة مستخدم' : 'تعديل مستخدم'} onClose={() => setModal(null)}>
        <Alert>{formError}</Alert>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <Field label="اسم المستخدم *"><input required minLength={3} className={inputClass} value={form.username} onChange={set('username')} /></Field>
          <Field label="البريد *"><input required type="email" className={inputClass} value={form.email} onChange={set('email')} /></Field>
          <Field label={modal === 'create' ? 'كلمة المرور * (8 أحرف على الأقل)' : 'كلمة مرور جديدة (اتركها فارغة للإبقاء)'}>
            <input type="password" minLength={8} required={modal === 'create'} className={inputClass} value={form.password} onChange={set('password')} />
          </Field>
          <Field label="الدور">
            <select className={inputClass} value={form.role} onChange={set('role')}>
              {Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          {modal !== 'create' && (
            <Field label="الحالة">
              <select className={inputClass} value={form.status} onChange={set('status')}>
                {Object.entries(USER_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
          )}
          <Field label="ربط بموظف">
            <select className={inputClass} value={form.employeeId} onChange={set('employeeId')}>
              <option value="">بدون</option>
              {employees?.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeNumber})</option>)}
            </select>
          </Field>
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
            <button type="button" className={btnSecondary} onClick={() => setModal(null)}>إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
