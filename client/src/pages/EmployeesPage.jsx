import { useState } from 'react';
import api from '../api/axios';
import {
  Alert, DataTable, Field, Modal, PageHeader, StatusBadge, EMPLOYEE_STATUS, btnPrimary, btnSecondary,
  errorMessage, fmtMoney, inputClass, useApi
} from '../components/ui';

const emptyForm = {
  employeeNumber: '', fullName: '', email: '', phone: '', nationalId: '', address: '', departmentId: '',
  jobTitle: '', salary: '', hireDate: '', shiftStart: '08:00', shiftEnd: '17:00', status: 'ACTIVE'
};

export default function EmployeesPage() {
  const [filters, setFilters] = useState({ search: '', departmentId: '', status: '' });
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const { data: employees, loading, error, reload } = useApi('/employees', params);
  const { data: departments } = useApi('/departments');

  const [modal, setModal] = useState(null); // null | 'create' | employee
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setModal('create');
  };

  const openEdit = (emp) => {
    setForm({
      ...emptyForm,
      ...Object.fromEntries(Object.keys(emptyForm).map((k) => [k, emp[k] ?? ''])),
      salary: String(emp.salary ?? ''),
      hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : '',
      departmentId: emp.departmentId || ''
    });
    setFormError('');
    setModal(emp);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, salary: Number(form.salary) };
      if (modal === 'create') {
        const res = await api.post('/employees', payload);
        setNotice(
          `تم إنشاء الموظف ${res.data.employee.fullName}. اسم المستخدم: ${res.data.user.username} — كلمة المرور المؤقتة: ${res.data.tempPassword} (احفظها الآن، لن تظهر مرة أخرى)`
        );
      } else {
        await api.put(`/employees/${modal.id}`, payload);
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

  const terminate = async (emp) => {
    if (!window.confirm(`إنهاء خدمة ${emp.fullName}؟ سيتم تعطيل حسابه.`)) return;
    try {
      await api.delete(`/employees/${emp.id}`);
      setNotice(`تم إنهاء خدمة ${emp.fullName}`);
      reload();
    } catch (err) {
      setNotice('');
      alert(errorMessage(err));
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const columns = [
    {
      label: 'الموظف',
      render: (r) => (
        <div>
          <p className="font-semibold">{r.fullName}</p>
          <p className="text-slate-500">{r.email}</p>
        </div>
      )
    },
    { label: 'الرقم', key: 'employeeNumber' },
    { label: 'القسم', render: (r) => r.department?.name || '—' },
    { label: 'المسمى', render: (r) => r.jobTitle || '—' },
    { label: 'الراتب', render: (r) => fmtMoney(r.salary) },
    { label: 'الحالة', render: (r) => <StatusBadge map={EMPLOYEE_STATUS} value={r.status} /> },
    {
      label: 'الإجراء',
      render: (r) => (
        <div className="flex gap-3">
          <button className="text-blue-600" onClick={() => openEdit(r)}>تعديل</button>
          {r.status !== 'TERMINATED' && (
            <button className="text-red-600" onClick={() => terminate(r)}>إنهاء الخدمة</button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="إدارة الموظفين" subtitle={employees ? `${employees.length} موظف` : ''}>
        <button className={btnPrimary} onClick={openCreate}>إضافة موظف</button>
      </PageHeader>

      <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>
      <Alert>{error}</Alert>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <input className={inputClass} placeholder="بحث بالاسم أو البريد أو الرقم" value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <select className={inputClass} value={filters.departmentId} onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}>
          <option value="">كل الأقسام</option>
          {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className={inputClass} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">كل الحالات</option>
          {Object.entries(EMPLOYEE_STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      <DataTable columns={columns} rows={employees} loading={loading} />

      <Modal open={!!modal} title={modal === 'create' ? 'إضافة موظف' : 'تعديل موظف'} onClose={() => setModal(null)}>
        <Alert>{formError}</Alert>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <Field label="رقم الموظف *"><input required className={inputClass} value={form.employeeNumber} onChange={set('employeeNumber')} /></Field>
          <Field label="الاسم الكامل *"><input required className={inputClass} value={form.fullName} onChange={set('fullName')} /></Field>
          <Field label="البريد الإلكتروني *"><input required type="email" className={inputClass} value={form.email} onChange={set('email')} /></Field>
          <Field label="الهاتف"><input className={inputClass} value={form.phone} onChange={set('phone')} /></Field>
          <Field label="الرقم القومي"><input className={inputClass} value={form.nationalId} onChange={set('nationalId')} /></Field>
          <Field label="القسم">
            <select className={inputClass} value={form.departmentId} onChange={set('departmentId')}>
              <option value="">—</option>
              {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="المسمى الوظيفي *"><input required className={inputClass} value={form.jobTitle} onChange={set('jobTitle')} /></Field>
          <Field label="الراتب الأساسي *"><input required type="number" min="0" step="0.01" className={inputClass} value={form.salary} onChange={set('salary')} /></Field>
          <Field label="تاريخ التعيين *"><input required type="date" className={inputClass} value={form.hireDate} onChange={set('hireDate')} /></Field>
          <Field label="العنوان"><input className={inputClass} value={form.address} onChange={set('address')} /></Field>
          <Field label="بداية الدوام"><input type="time" className={inputClass} value={form.shiftStart} onChange={set('shiftStart')} /></Field>
          <Field label="نهاية الدوام"><input type="time" className={inputClass} value={form.shiftEnd} onChange={set('shiftEnd')} /></Field>
          {modal !== 'create' && (
            <Field label="الحالة">
              <select className={inputClass} value={form.status} onChange={set('status')}>
                {Object.entries(EMPLOYEE_STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </Field>
          )}
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
            <button type="button" className={btnSecondary} onClick={() => setModal(null)}>إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
