import { useState } from 'react';
import api from '../api/axios';
import {
  Alert,
  DataTable,
  Field,
  Modal,
  PageHeader,
  btnPrimary,
  btnSecondary,
  currentRole,
  errorMessage,
  fmtDate,
  inputClass,
  useApi
} from '../components/ui';

const emptyForm = { name: '', managerId: '' };

export default function DepartmentsPage() {
  const superAdmin = currentRole() === 'SUPER_ADMIN';
  const { data, loading, error, reload } = useApi('/departments');
  const { data: employees } = useApi('/employees');
  const [modal, setModal] = useState(null); // null | 'create' | department
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setModal('create');
  };
  const openEdit = (d) => {
    setForm({ name: d.name, managerId: d.managerId || '' });
    setFormError('');
    setModal(d);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { name: form.name.trim() };
      if (form.managerId) payload.managerId = form.managerId;
      if (modal === 'create') {
        await api.post('/departments', payload);
        setNotice('تم إضافة القسم');
      } else {
        await api.put(`/departments/${modal.id}`, payload);
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

  const remove = async (d) => {
    if (!window.confirm(`حذف قسم ${d.name}؟`)) return;
    setActionError('');
    try {
      await api.delete(`/departments/${d.id}`);
      setNotice('تم حذف القسم');
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const editingHasManager = modal && modal !== 'create' && !!modal.managerId;

  const columns = [
    { label: 'اسم القسم', key: 'name' },
    { label: 'المدير', render: (r) => r.manager?.fullName || '—' },
    { label: 'عدد الموظفين', render: (r) => r.employees?.length ?? 0 },
    { label: 'تاريخ الإنشاء', render: (r) => fmtDate(r.createdAt) },
    {
      label: 'الإجراء',
      render: (r) => {
        const hasEmployees = (r.employees?.length ?? 0) > 0;
        return (
          <div className="flex gap-3">
            <button type="button" className="text-blue-600" onClick={() => openEdit(r)}>
              تعديل
            </button>
            {superAdmin && (
              <button
                type="button"
                className="text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={hasEmployees}
                title={hasEmployees ? 'لا يمكن حذف قسم به موظفون' : undefined}
                onClick={() => remove(r)}
              >
                حذف
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <PageHeader title="الأقسام" subtitle={superAdmin ? '' : 'الحذف متاح للمدير العام فقط'}>
        <button type="button" className={btnPrimary} onClick={openCreate}>
          إضافة قسم
        </button>
      </PageHeader>
      <Alert type="success" onClose={() => setNotice('')}>
        {notice}
      </Alert>
      <Alert onClose={() => setActionError('')}>{actionError}</Alert>
      <Alert>{error}</Alert>
      <DataTable columns={columns} rows={data} loading={loading} empty="لا توجد أقسام بعد" />

      <Modal open={!!modal} title={modal === 'create' ? 'إضافة قسم' : 'تعديل قسم'} onClose={() => setModal(null)}>
        <Alert>{formError}</Alert>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <Field label="اسم القسم *">
            <input required minLength={2} className={inputClass} value={form.name} onChange={set('name')} />
          </Field>
          <Field label="مدير القسم">
            <select className={inputClass} value={form.managerId} onChange={set('managerId')}>
              <option value="" disabled={editingHasManager}>
                بدون
              </option>
              {employees?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeNumber})
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setModal(null)}>
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
