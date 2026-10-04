import { useState } from 'react';
import api from '../api/axios';
import { Alert, Card, Field, PageHeader, ROLES, btnPrimary, errorMessage, fmtDate, inputClass, useApi } from '../components/ui';

export default function ProfilePage() {
  const { data: me, loading, error } = useApi('/users/me');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState({ type: 'success', text: '' });
  const [saving, setSaving] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return setMsg({ type: 'error', text: 'كلمتا المرور غير متطابقتين' });
    setSaving(true);
    try {
      await api.put('/users/me/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setMsg({ type: 'success', text: 'تم تغيير كلمة المرور' });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const emp = me?.employee;
  const name = emp?.fullName || me?.username || '';

  return (
    <div>
      <PageHeader title="الملف الشخصي" />
      <Alert>{error}</Alert>
      {me?.forcePasswordChange && <Alert type="info">يجب تغيير كلمة المرور المؤقتة.</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          {loading ? 'جارٍ التحميل...' : (
            <>
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">{name.charAt(0)}</div>
                <div>
                  <h2 className="text-xl font-bold">{name}</h2>
                  <p className="text-slate-500">{emp?.jobTitle || ROLES[me?.role]}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-slate-500">اسم المستخدم</dt><dd>{me?.username}</dd>
                <dt className="text-slate-500">البريد</dt><dd>{me?.email}</dd>
                <dt className="text-slate-500">الدور</dt><dd>{ROLES[me?.role] || me?.role}</dd>
                {emp && (
                  <>
                    <dt className="text-slate-500">رقم الموظف</dt><dd>{emp.employeeNumber}</dd>
                    <dt className="text-slate-500">القسم</dt><dd>{emp.department?.name || '—'}</dd>
                    <dt className="text-slate-500">الهاتف</dt><dd>{emp.phone || '—'}</dd>
                    <dt className="text-slate-500">تاريخ التعيين</dt><dd>{fmtDate(emp.hireDate)}</dd>
                    <dt className="text-slate-500">الدوام</dt><dd>{emp.shiftStart || '—'} – {emp.shiftEnd || '—'}</dd>
                  </>
                )}
                <dt className="text-slate-500">آخر دخول</dt><dd>{fmtDate(me?.lastLogin)}</dd>
              </dl>
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">تغيير كلمة المرور</h2>
          <Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert>
          <form onSubmit={changePassword} className="space-y-4">
            <Field label="كلمة المرور الحالية"><input required type="password" className={inputClass} value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <Field label="كلمة المرور الجديدة (8 أحرف على الأقل)"><input required minLength={8} type="password" className={inputClass} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <Field label="تأكيد كلمة المرور"><input required minLength={8} type="password" className={inputClass} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
            <button className={btnPrimary} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
