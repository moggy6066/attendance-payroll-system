import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Alert, Card, Field, PageHeader, btnPrimary, errorMessage, inputClass, useApi } from '../components/ui';

const FIELDS = [
  ['company_name', 'اسم الشركة', 'text'],
  ['attendance_radius_meters', 'نصف قطر GPS (متر)', 'number'],
  ['default_shift_start', 'وقت بدء الدوام الافتراضي', 'time'],
  ['default_shift_end', 'وقت نهاية الدوام الافتراضي', 'time'],
  ['timezone', 'المنطقة الزمنية', 'text']
];

export default function SettingsPage() {
  const { data, loading, error } = useApi('/settings');
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState({ type: 'success', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(Object.fromEntries(FIELDS.map(([k]) => [k, data.find((s) => s.key === k)?.value ?? ''])));
  }, [data]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      setMsg({ type: 'success', text: 'تم حفظ الإعدادات' });
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="الإعدادات" />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert>
      <Card>
        {loading ? 'جارٍ التحميل...' : (
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            {FIELDS.map(([key, label, type]) => (
              <Field key={key} label={label}>
                <input type={type} className={inputClass} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </Field>
            ))}
            <p className="text-xs text-slate-500 md:col-span-2">
              مواعيد الدوام هنا تُستخدم لحساب التأخير والوقت الإضافي للموظفين الذين ليس لهم دوام خاص.
              تغيير المنطقة الزمنية هنا للعرض فقط؛ حساب التواريخ في السيرفر يتبع APP_TIMEZONE في ملف .env.
            </p>
            <div className="md:col-span-2">
              <button className={btnPrimary} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
